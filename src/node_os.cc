// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

#include "env-inl.h"
#include "node_debug.h"
#include "node_external_reference.h"
#include "string_bytes.h"

#ifdef __MINGW32__
# include <io.h>
#endif  // __MINGW32__

#ifdef __POSIX__
# include <climits>         // PATH_MAX on Solaris.
#endif  // __POSIX__

#if defined(__APPLE__) || defined(__FreeBSD__)
#include <sys/sysctl.h>
#endif

#include <array>
#include <cerrno>
#include <cstring>

namespace node {
namespace os {

using v8::Array;
using v8::ArrayBuffer;
using v8::Boolean;
using v8::Context;
using v8::Float64Array;
using v8::FunctionCallbackInfo;
using v8::Int32;
using v8::Integer;
using v8::Isolate;
using v8::Local;
using v8::LocalVector;
using v8::MaybeLocal;
using v8::Name;
using v8::NewStringType;
using v8::Null;
using v8::Number;
using v8::Object;
using v8::String;
using v8::Value;


static void GetHostname(const FunctionCallbackInfo<Value>& args) {
  Environment* env = Environment::GetCurrent(args);
  char buf[UV_MAXHOSTNAMESIZE];
  size_t size = sizeof(buf);
  int r = uv_os_gethostname(buf, &size);

  if (r != 0) {
    CHECK_GE(args.Length(), 1);
    USE(env->CollectUVExceptionInfo(
        args[args.Length() - 1], r, "uv_os_gethostname"));
    return;
  }

  Local<Value> ret;
  if (String::NewFromUtf8(env->isolate(), buf).ToLocal(&ret)) {
    args.GetReturnValue().Set(ret);
  }
}

static void GetOSInformation(const FunctionCallbackInfo<Value>& args) {
  Environment* env = Environment::GetCurrent(args);
  uv_utsname_t info;
  int err = uv_os_uname(&info);

  if (err != 0) {
    CHECK_GE(args.Length(), 1);
    USE(env->CollectUVExceptionInfo(
        args[args.Length() - 1], err, "uv_os_uname"));
    return;
  }

  // [sysname, version, release, machine]
  Local<Value> osInformation[4];
  if (String::NewFromUtf8(env->isolate(), info.sysname)
          .ToLocal(&osInformation[0]) &&
      String::NewFromUtf8(env->isolate(), info.version)
          .ToLocal(&osInformation[1]) &&
      String::NewFromUtf8(env->isolate(), info.release)
          .ToLocal(&osInformation[2]) &&
      String::NewFromUtf8(env->isolate(), info.machine)
          .ToLocal(&osInformation[3])) {
    args.GetReturnValue().Set(
        Array::New(env->isolate(), osInformation, arraysize(osInformation)));
  }
}

static void GetCPUInfo(const FunctionCallbackInfo<Value>& args) {
  Environment* env = Environment::GetCurrent(args);
  Isolate* isolate = env->isolate();

  uv_cpu_info_t* cpu_infos;
  int count;

  int err = uv_cpu_info(&cpu_infos, &count);
  if (err)
    return;

  // It's faster to create an array packed with all the data and
  // assemble them into objects in JS than to call Object::Set() repeatedly
  // The array is in the format
  // [model, speed, (5 entries of cpu_times), model2, speed2, ...]
  LocalVector<Value> result(isolate);
  result.reserve(count * 7);
  for (int i = 0; i < count; i++) {
    uv_cpu_info_t* ci = cpu_infos + i;
    result.emplace_back(OneByteString(isolate, ci->model));
    result.emplace_back(Number::New(isolate, ci->speed));
    result.emplace_back(
        Number::New(isolate, static_cast<double>(ci->cpu_times.user)));
    result.emplace_back(
        Number::New(isolate, static_cast<double>(ci->cpu_times.nice)));
    result.emplace_back(
        Number::New(isolate, static_cast<double>(ci->cpu_times.sys)));
    result.emplace_back(
        Number::New(isolate, static_cast<double>(ci->cpu_times.idle)));
    result.emplace_back(
        Number::New(isolate, static_cast<double>(ci->cpu_times.irq)));
  }

  uv_free_cpu_info(cpu_infos, count);
  args.GetReturnValue().Set(Array::New(isolate, result.data(), result.size()));
}

static int parse_number_at_end_of_line(char *line) {
	char *end = &line[strlen(line) - 2];
	int num = 0;
	int multi = 1;
	while (*end >= '0' && *end <= '9') {
		num += (*end - '0') * multi;
		multi *= 10;
		--end;
	}
	return num;
}

static void GetProperCPUCount(const FunctionCallbackInfo<Value>& args) {
#if defined(_WIN32)
  SYSTEM_LOGICAL_PROCESSOR_INFORMATION info[1024];
  DWORD returnLength = sizeof(SYSTEM_LOGICAL_PROCESSOR_INFORMATION) * 1024;
  BOOL success = GetLogicalProcessorInformation(&info[0], &returnLength);

  int proper_cpu_count = 0;

  if (success) {
    DWORD byteOffset = 0;
    PSYSTEM_LOGICAL_PROCESSOR_INFORMATION ptr = &info[0];
    while (byteOffset + sizeof(SYSTEM_LOGICAL_PROCESSOR_INFORMATION) <= returnLength) {
      if (ptr->Relationship == RelationProcessorCore) {
        ++proper_cpu_count;
      }

      byteOffset += sizeof(SYSTEM_LOGICAL_PROCESSOR_INFORMATION);
      ++ptr;
    }
  }
  else {
    proper_cpu_count = 1;
  }

  args.GetReturnValue().Set(proper_cpu_count);
#elif defined(__linux__)
  char line[1024];
  FILE *file = fopen("/proc/cpuinfo", "r");

  if (file != NULL) {
    int cores[1024];
    memset(cores, 0, sizeof(cores));

    int cpu_count = 0;
    int physical_id = -1;
    int per_cpu_cores = -1;
    int processor_count = 0;

    while (fgets(line, sizeof(line), file)) {
      if (strncmp(line, "processor", 9) == 0) {
        ++processor_count;
        if (physical_id >= 0 && per_cpu_cores > 0) {
          if (physical_id + 1 > cpu_count) {
            cpu_count = physical_id + 1;
          }
          cores[physical_id] = per_cpu_cores;
          physical_id = -1;
          per_cpu_cores = -1;
        }
      }
      else if (strncmp(line, "physical id", 11) == 0) {
        physical_id = parse_number_at_end_of_line(line);
      }
      else if (strncmp(line, "cpu cores", 9) == 0) {
        per_cpu_cores = parse_number_at_end_of_line(line);
      }
    }
    fclose(file);

    if (physical_id >= 0 && per_cpu_cores > 0) {
      if (physical_id + 1 > cpu_count) {
        cpu_count = physical_id + 1;
      }
      cores[physical_id] = per_cpu_cores;
    }

    int proper_cpu_count = 0;
    for (int i = 0; i < cpu_count; ++i) {
      proper_cpu_count += cores[i];
    }

    if (proper_cpu_count > 0) {
      args.GetReturnValue().Set(proper_cpu_count);
    }
    else {
      args.GetReturnValue().Set(processor_count == 0 ? 1 : processor_count);
    }
  }
  else {
    args.GetReturnValue().Set(1);
  };
#elif defined(__APPLE__) || defined(__FreeBSD__)
  uint32_t proper_cpu_count = 1;
  size_t count_length = sizeof(count_length);
  sysctlbyname("hw.physicalcpu", &proper_cpu_count, &count_length, 0, 0);
  args.GetReturnValue().Set((int)proper_cpu_count);
#else
  args.GetReturnValue().Set(1);
#endif
}


static void GetWindowsSDKs(const FunctionCallbackInfo<Value>& args) {
#ifdef _WIN32
  Environment* env = Environment::GetCurrent(args);
  Isolate* isolate = env->isolate();

  std::vector<Local<Value>> result;

  HKEY key;
  LSTATUS status = RegOpenKeyExA(HKEY_LOCAL_MACHINE, "SOFTWARE\\Microsoft\\Windows Kits\\Installed Roots", 0, KEY_READ | KEY_QUERY_VALUE, &key);

  char name[256];
  DWORD nameLength;
  for (DWORD i = 0;; ++i) {
	nameLength = sizeof(name);
	status = RegEnumKeyExA(key, i, &name[0], &nameLength, NULL, NULL, NULL, NULL);

	if (status != ERROR_SUCCESS) {
	  break;
	}
        
    result.emplace_back(String::NewFromUtf8(isolate, name).ToLocalChecked());
  }

  RegCloseKey(key);

  args.GetReturnValue().Set(Array::New(isolate, result.data(), result.size()));
#else
  Environment* env = Environment::GetCurrent(args);
  Isolate* isolate = env->isolate();
  std::vector<Local<Value>> result;
  args.GetReturnValue().Set(Array::New(isolate, result.data(), result.size()));
#endif
}

#ifdef _WIN32
static 	PROCESS_INFORMATION processInfo = {};

static struct ods_buffer_type
{
	DWORD process_id;
	char  data[4096 - sizeof(DWORD)];
}*ods_buffer;

static HANDLE ods_data_ready;
static HANDLE ods_buffer_ready;

static DWORD WINAPI ods_proc(LPVOID arg)
{
	DWORD ret = 0;

	HANDLE output = GetStdHandle(STD_OUTPUT_HANDLE);
	assert(output != NULL);

	for (;;)
	{
		SetEvent(ods_buffer_ready);

		DWORD wait = WaitForSingleObject(ods_data_ready, INFINITE);
		assert(wait == WAIT_OBJECT_0);

		if (processInfo.dwProcessId != 0 && processInfo.dwProcessId == ods_buffer->process_id) {

			DWORD length = 0;
			while (length < sizeof(ods_buffer->data) && ods_buffer->data[length] != 0)
			{
				length++;
			}

			if (length != 0)
			{
				DWORD written;
				WriteFile(output, ods_buffer->data, length, &written, NULL);
			}
		}
	}
}

void ods_capture()
{
	if (IsDebuggerPresent())
	{
		return;
	}

	HANDLE file = CreateFileMappingA(INVALID_HANDLE_VALUE, NULL, PAGE_READWRITE, 0, sizeof(*ods_buffer), "DBWIN_BUFFER");
	assert(file != INVALID_HANDLE_VALUE);

	ods_buffer = (ods_buffer_type*)MapViewOfFile(file, SECTION_MAP_READ, 0, 0, 0);
	assert(ods_buffer != NULL);

	ods_buffer_ready = CreateEventA(NULL, FALSE, FALSE, "DBWIN_BUFFER_READY");
	assert(ods_buffer_ready);

	ods_data_ready = CreateEventA(NULL, FALSE, FALSE, "DBWIN_DATA_READY");
	assert(ods_data_ready);

	HANDLE thread = CreateThread(NULL, 0, ods_proc, NULL, 0, NULL);
	assert(thread != NULL);
}

void execute_sync(const char* command, const char* directory) {
	STARTUPINFOA startupInfo;
	memset(&startupInfo, 0, sizeof(startupInfo));
	memset(&processInfo, 0, sizeof(processInfo));
	startupInfo.cb = sizeof(startupInfo);
	CreateProcessA(NULL, (char*)command, NULL, NULL, FALSE, CREATE_DEFAULT_ERROR_MODE, NULL, directory, &startupInfo, &processInfo);
}
#endif

void RunProcess(const FunctionCallbackInfo<Value>& args)
{
#ifdef _WIN32
  CHECK_EQ(args.Length(), 2);
  CHECK(args[0]->IsString());
  CHECK(args[1]->IsString());

  Environment* env = Environment::GetCurrent(args);
  
  node::Utf8Value path(env->isolate(), args[0]);
  node::Utf8Value dir(env->isolate(), args[1]);

	ods_capture();

	execute_sync(*path, *dir);

	WaitForSingleObject(processInfo.hProcess, INFINITE);
	CloseHandle(processInfo.hProcess);
	CloseHandle(processInfo.hThread);
#endif
}


static void GetFreeMemory(const FunctionCallbackInfo<Value>& args) {
  double amount = static_cast<double>(uv_get_free_memory());
  args.GetReturnValue().Set(amount);
}

static double FastGetFreeMemory(Local<Value> receiver) {
  TRACK_V8_FAST_API_CALL("os.freemem");
  return static_cast<double>(uv_get_free_memory());
}

static v8::CFunction fast_get_free_memory(
    v8::CFunction::Make(FastGetFreeMemory));

static void GetTotalMemory(const FunctionCallbackInfo<Value>& args) {
  double amount = static_cast<double>(uv_get_total_memory());
  args.GetReturnValue().Set(amount);
}

double FastGetTotalMemory(Local<Value> receiver) {
  TRACK_V8_FAST_API_CALL("os.totalmem");
  return static_cast<double>(uv_get_total_memory());
}

static v8::CFunction fast_get_total_memory(
    v8::CFunction::Make(FastGetTotalMemory));

static void GetUptime(const FunctionCallbackInfo<Value>& args) {
  Environment* env = Environment::GetCurrent(args);
  double uptime;
  int err = uv_uptime(&uptime);
  if (err != 0) {
    USE(env->CollectUVExceptionInfo(args[args.Length() - 1], err, "uv_uptime"));
    return;
  }

  args.GetReturnValue().Set(uptime);
}


static void GetLoadAvg(const FunctionCallbackInfo<Value>& args) {
  CHECK(args[0]->IsFloat64Array());
  Local<Float64Array> array = args[0].As<Float64Array>();
  CHECK_EQ(array->Length(), 3);
  Local<ArrayBuffer> ab = array->Buffer();
  double* loadavg = static_cast<double*>(ab->Data());
  uv_loadavg(loadavg);
}


static void GetInterfaceAddresses(const FunctionCallbackInfo<Value>& args) {
  Environment* env = Environment::GetCurrent(args);
  Isolate* isolate = env->isolate();
  uv_interface_address_t* interfaces;
  int count, i;
  char ip[INET6_ADDRSTRLEN];
  char netmask[INET6_ADDRSTRLEN];
  std::array<char, 18> mac;
  Local<String> name, family;

  int err = uv_interface_addresses(&interfaces, &count);

  if (err == UV_ENOSYS) return;

  if (err) {
    CHECK_GE(args.Length(), 1);
    USE(env->CollectUVExceptionInfo(
        args[args.Length() - 1], errno, "uv_interface_addresses"));
    return;
  }

  Local<Value> no_scope_id = Integer::New(isolate, -1);
  LocalVector<Value> result(isolate);
  result.reserve(count * 7);
  for (i = 0; i < count; i++) {
    const char* const raw_name = interfaces[i].name;

    // Use UTF-8 on both Windows and Unixes (While it may be true that UNIX
    // systems are somewhat encoding-agnostic here, it’s more than reasonable
    // to assume UTF8 as the default as well. It’s what people will expect if
    // they name the interface from any input that uses UTF-8, which should be
    // the most frequent case by far these days.)
    if (!String::NewFromUtf8(isolate, raw_name).ToLocal(&name)) {
      // Error occurred creating the string.
      return;
    }

    snprintf(mac.data(),
             mac.size(),
             "%02x:%02x:%02x:%02x:%02x:%02x",
             static_cast<unsigned char>(interfaces[i].phys_addr[0]),
             static_cast<unsigned char>(interfaces[i].phys_addr[1]),
             static_cast<unsigned char>(interfaces[i].phys_addr[2]),
             static_cast<unsigned char>(interfaces[i].phys_addr[3]),
             static_cast<unsigned char>(interfaces[i].phys_addr[4]),
             static_cast<unsigned char>(interfaces[i].phys_addr[5]));

    if (interfaces[i].address.address4.sin_family == AF_INET) {
      uv_ip4_name(&interfaces[i].address.address4, ip, sizeof(ip));
      uv_ip4_name(&interfaces[i].netmask.netmask4, netmask, sizeof(netmask));
      family = env->ipv4_string();
    } else if (interfaces[i].address.address4.sin_family == AF_INET6) {
      uv_ip6_name(&interfaces[i].address.address6, ip, sizeof(ip));
      uv_ip6_name(&interfaces[i].netmask.netmask6, netmask, sizeof(netmask));
      family = env->ipv6_string();
    } else {
      strncpy(ip, "<unknown sa family>", INET6_ADDRSTRLEN);
      family = env->unknown_string();
    }

    result.emplace_back(name);
    result.emplace_back(OneByteString(isolate, ip));
    result.emplace_back(OneByteString(isolate, netmask));
    result.emplace_back(family);
    result.emplace_back(FIXED_ONE_BYTE_STRING(isolate, mac));
    result.emplace_back(
        Boolean::New(env->isolate(), interfaces[i].is_internal));
    if (interfaces[i].address.address4.sin_family == AF_INET6) {
      uint32_t scopeid = interfaces[i].address.address6.sin6_scope_id;
      result.emplace_back(Integer::NewFromUnsigned(isolate, scopeid));
    } else {
      result.emplace_back(no_scope_id);
    }
  }

  uv_free_interface_addresses(interfaces, count);
  args.GetReturnValue().Set(Array::New(isolate, result.data(), result.size()));
}


static void GetHomeDirectory(const FunctionCallbackInfo<Value>& args) {
  Environment* env = Environment::GetCurrent(args);
  char buf[PATH_MAX];

  size_t len = sizeof(buf);
  const int err = uv_os_homedir(buf, &len);

  if (err) {
    CHECK_GE(args.Length(), 1);
    USE(env->CollectUVExceptionInfo(
        args[args.Length() - 1], err, "uv_os_homedir"));
    return;
  }

  Local<String> home;
  if (String::NewFromUtf8(env->isolate(), buf, NewStringType::kNormal, len)
          .ToLocal(&home)) {
    args.GetReturnValue().Set(home);
  }
}


static void GetUserInfo(const FunctionCallbackInfo<Value>& args) {
  Environment* env = Environment::GetCurrent(args);
  uv_passwd_t pwd;
  enum encoding encoding;

  if (args[0]->IsObject()) {
    Local<Object> options = args[0].As<Object>();
    MaybeLocal<Value> maybe_encoding = options->Get(env->context(),
                                                    env->encoding_string());
    Local<Value> encoding_opt;
    if (!maybe_encoding.ToLocal(&encoding_opt))
        return;

    encoding = ParseEncoding(env->isolate(), encoding_opt, UTF8);
  } else {
    encoding = UTF8;
  }

  if (const int err = uv_os_get_passwd(&pwd)) {
    CHECK_GE(args.Length(), 2);
    USE(env->CollectUVExceptionInfo(
        args[args.Length() - 1], err, "uv_os_get_passwd"));
    return;
  }

  auto free_passwd = OnScopeLeave([&] { uv_os_free_passwd(&pwd); });

#ifdef _WIN32
  Local<Value> uid = Number::New(
      env->isolate(),
      static_cast<double>(static_cast<int32_t>(pwd.uid & 0xFFFFFFFF)));
  Local<Value> gid = Number::New(
      env->isolate(),
      static_cast<double>(static_cast<int32_t>(pwd.gid & 0xFFFFFFFF)));
#else
  Local<Value> uid = Number::New(env->isolate(), pwd.uid);
  Local<Value> gid = Number::New(env->isolate(), pwd.gid);
#endif

  Local<Value> username;
  if (!StringBytes::Encode(env->isolate(), pwd.username, encoding)
           .ToLocal(&username)) {
    return;
  }

  Local<Value> homedir;
  if (!StringBytes::Encode(env->isolate(), pwd.homedir, encoding)
           .ToLocal(&homedir)) {
    return;
  }

  Local<Value> shell = Null(env->isolate());
  if (pwd.shell != nullptr &&
      !StringBytes::Encode(env->isolate(), pwd.shell, encoding)
           .ToLocal(&shell)) {
    return;
  }

  constexpr size_t kRetLength = 5;
  Local<Name> names[kRetLength] = {env->uid_string(),
                                   env->gid_string(),
                                   env->username_string(),
                                   env->homedir_string(),
                                   env->shell_string()};
  Local<Value> values[kRetLength] = {uid, gid, username, homedir, shell};

  args.GetReturnValue().Set(Object::New(
      env->isolate(), Null(env->isolate()), &names[0], &values[0], kRetLength));
}


static void SetPriority(const FunctionCallbackInfo<Value>& args) {
  Environment* env = Environment::GetCurrent(args);

  CHECK_EQ(args.Length(), 3);
  CHECK(args[0]->IsInt32());
  CHECK(args[1]->IsInt32());

  const int pid = args[0].As<Int32>()->Value();
  const int priority = args[1].As<Int32>()->Value();
  const int err = uv_os_setpriority(pid, priority);

  if (err) {
    CHECK(args[2]->IsObject());
    if (env->CollectUVExceptionInfo(args[2], err, "uv_os_setpriority")
            .IsNothing()) {
      return;
    }
  }

  args.GetReturnValue().Set(err);
}


static void GetPriority(const FunctionCallbackInfo<Value>& args) {
  Environment* env = Environment::GetCurrent(args);

  CHECK_EQ(args.Length(), 2);
  CHECK(args[0]->IsInt32());

  const int pid = args[0].As<Int32>()->Value();
  int priority;
  const int err = uv_os_getpriority(pid, &priority);

  if (err) {
    CHECK(args[1]->IsObject());
    USE(env->CollectUVExceptionInfo(args[1], err, "uv_os_getpriority"));
    return;
  }

  args.GetReturnValue().Set(priority);
}

static void GetAvailableParallelism(const FunctionCallbackInfo<Value>& args) {
  unsigned int parallelism = uv_available_parallelism();
  args.GetReturnValue().Set(parallelism);
}

uint32_t FastGetAvailableParallelism(v8::Local<v8::Value> receiver) {
  TRACK_V8_FAST_API_CALL("os.availableParallelism");
  return uv_available_parallelism();
}

static v8::CFunction fast_get_available_parallelism(
    v8::CFunction::Make(FastGetAvailableParallelism));

void Initialize(Local<Object> target,
                Local<Value> unused,
                Local<Context> context,
                void* priv) {
  Environment* env = Environment::GetCurrent(context);
  SetMethod(context, target, "getHostname", GetHostname);
  SetMethod(context, target, "getLoadAvg", GetLoadAvg);
  SetMethod(context, target, "getUptime", GetUptime);
  SetFastMethodNoSideEffect(
      context, target, "getTotalMem", GetTotalMemory, &fast_get_total_memory);
  SetFastMethodNoSideEffect(
      context, target, "getFreeMem", GetFreeMemory, &fast_get_free_memory);
  SetMethod(context, target, "getCPUs", GetCPUInfo);
  SetMethod(context, target, "getProperCPUCount", GetProperCPUCount);
  SetMethod(context, target, "getWindowsSDKs", GetWindowsSDKs);
  SetMethod(context, target, "_runProcess", RunProcess);
  SetMethod(context, target, "getInterfaceAddresses", GetInterfaceAddresses);
  SetMethod(context, target, "getHomeDirectory", GetHomeDirectory);
  SetMethod(context, target, "getUserInfo", GetUserInfo);
  SetMethod(context, target, "setPriority", SetPriority);
  SetMethod(context, target, "getPriority", GetPriority);
  SetFastMethodNoSideEffect(context,
                            target,
                            "getAvailableParallelism",
                            GetAvailableParallelism,
                            &fast_get_available_parallelism);
  SetMethod(context, target, "getOSInformation", GetOSInformation);
  target
      ->Set(context,
            FIXED_ONE_BYTE_STRING(env->isolate(), "isBigEndian"),
            Boolean::New(env->isolate(), IsBigEndian()))
      .Check();
}

void RegisterExternalReferences(ExternalReferenceRegistry* registry) {
  registry->Register(GetHostname);
  registry->Register(GetLoadAvg);
  registry->Register(GetUptime);
  registry->Register(GetTotalMemory);
  registry->Register(FastGetTotalMemory);
  registry->Register(fast_get_total_memory.GetTypeInfo());
  registry->Register(GetFreeMemory);
  registry->Register(FastGetFreeMemory);
  registry->Register(fast_get_free_memory.GetTypeInfo());
  registry->Register(GetCPUInfo);
  registry->Register(GetProperCPUCount);
  registry->Register(GetInterfaceAddresses);
  registry->Register(GetHomeDirectory);
  registry->Register(GetUserInfo);
  registry->Register(SetPriority);
  registry->Register(GetPriority);
  registry->Register(GetAvailableParallelism);
  registry->Register(FastGetAvailableParallelism);
  registry->Register(fast_get_available_parallelism.GetTypeInfo());
  registry->Register(GetOSInformation);
}

}  // namespace os
}  // namespace node

NODE_BINDING_CONTEXT_AWARE_INTERNAL(os, node::os::Initialize)
NODE_BINDING_EXTERNAL_REFERENCE(os, node::os::RegisterExternalReferences)
