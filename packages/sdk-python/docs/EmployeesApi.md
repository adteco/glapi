# glapi.EmployeesApi

All URIs are relative to *http://localhost:3031/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**employees_create**](EmployeesApi.md#employees_create) | **POST** /api/employees | Create a new employees
[**employees_delete**](EmployeesApi.md#employees_delete) | **DELETE** /api/employees/{id} | Delete a employees
[**employees_get**](EmployeesApi.md#employees_get) | **GET** /api/employees/{id} | Get a specific employees by ID
[**employees_list**](EmployeesApi.md#employees_list) | **GET** /api/employees | List all employees
[**employees_update**](EmployeesApi.md#employees_update) | **PUT** /api/employees/{id} | Update an existing employees


# **employees_create**
> object employees_create(body)

Create a new employees

### Example

* Bearer (JWT) Authentication (ClerkAuth):

```python
import glapi
from glapi.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost:3031/api
# See configuration.py for a list of all supported configuration parameters.
configuration = glapi.Configuration(
    host = "http://localhost:3031/api"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization (JWT): ClerkAuth
configuration = glapi.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with glapi.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = glapi.EmployeesApi(api_client)
    body = None # object | 

    try:
        # Create a new employees
        api_response = api_instance.employees_create(body)
        print("The response of EmployeesApi->employees_create:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling EmployeesApi->employees_create: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body** | **object**|  | 

### Return type

**object**

### Authorization

[ClerkAuth](../README.md#ClerkAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful response |  -  |
**401** | Unauthorized - Invalid or missing authentication |  -  |
**404** | Resource not found |  -  |
**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **employees_delete**
> object employees_delete(id)

Delete a employees

### Example

* Bearer (JWT) Authentication (ClerkAuth):

```python
import glapi
from glapi.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost:3031/api
# See configuration.py for a list of all supported configuration parameters.
configuration = glapi.Configuration(
    host = "http://localhost:3031/api"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization (JWT): ClerkAuth
configuration = glapi.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with glapi.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = glapi.EmployeesApi(api_client)
    id = UUID('38400000-8cf0-11bd-b23e-10b96e4ef00d') # UUID | employees ID

    try:
        # Delete a employees
        api_response = api_instance.employees_delete(id)
        print("The response of EmployeesApi->employees_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling EmployeesApi->employees_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **UUID**| employees ID | 

### Return type

**object**

### Authorization

[ClerkAuth](../README.md#ClerkAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful response |  -  |
**401** | Unauthorized - Invalid or missing authentication |  -  |
**404** | Resource not found |  -  |
**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **employees_get**
> object employees_get(id)

Get a specific employees by ID

### Example

* Bearer (JWT) Authentication (ClerkAuth):

```python
import glapi
from glapi.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost:3031/api
# See configuration.py for a list of all supported configuration parameters.
configuration = glapi.Configuration(
    host = "http://localhost:3031/api"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization (JWT): ClerkAuth
configuration = glapi.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with glapi.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = glapi.EmployeesApi(api_client)
    id = UUID('38400000-8cf0-11bd-b23e-10b96e4ef00d') # UUID | employees ID

    try:
        # Get a specific employees by ID
        api_response = api_instance.employees_get(id)
        print("The response of EmployeesApi->employees_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling EmployeesApi->employees_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **UUID**| employees ID | 

### Return type

**object**

### Authorization

[ClerkAuth](../README.md#ClerkAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful response |  -  |
**401** | Unauthorized - Invalid or missing authentication |  -  |
**404** | Resource not found |  -  |
**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **employees_list**
> object employees_list()

List all employees

### Example

* Bearer (JWT) Authentication (ClerkAuth):

```python
import glapi
from glapi.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost:3031/api
# See configuration.py for a list of all supported configuration parameters.
configuration = glapi.Configuration(
    host = "http://localhost:3031/api"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization (JWT): ClerkAuth
configuration = glapi.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with glapi.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = glapi.EmployeesApi(api_client)

    try:
        # List all employees
        api_response = api_instance.employees_list()
        print("The response of EmployeesApi->employees_list:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling EmployeesApi->employees_list: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

[ClerkAuth](../README.md#ClerkAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful response |  -  |
**401** | Unauthorized - Invalid or missing authentication |  -  |
**404** | Resource not found |  -  |
**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **employees_update**
> object employees_update(id, body)

Update an existing employees

### Example

* Bearer (JWT) Authentication (ClerkAuth):

```python
import glapi
from glapi.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost:3031/api
# See configuration.py for a list of all supported configuration parameters.
configuration = glapi.Configuration(
    host = "http://localhost:3031/api"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization (JWT): ClerkAuth
configuration = glapi.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with glapi.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = glapi.EmployeesApi(api_client)
    id = UUID('38400000-8cf0-11bd-b23e-10b96e4ef00d') # UUID | employees ID
    body = None # object | 

    try:
        # Update an existing employees
        api_response = api_instance.employees_update(id, body)
        print("The response of EmployeesApi->employees_update:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling EmployeesApi->employees_update: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **UUID**| employees ID | 
 **body** | **object**|  | 

### Return type

**object**

### Authorization

[ClerkAuth](../README.md#ClerkAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful response |  -  |
**401** | Unauthorized - Invalid or missing authentication |  -  |
**404** | Resource not found |  -  |
**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

