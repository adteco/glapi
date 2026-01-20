# glapi.DepartmentsApi

All URIs are relative to *http://localhost:3031/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**departments_create**](DepartmentsApi.md#departments_create) | **POST** /api/departments | Create a new departments
[**departments_delete**](DepartmentsApi.md#departments_delete) | **DELETE** /api/departments/{id} | Delete a departments
[**departments_get**](DepartmentsApi.md#departments_get) | **GET** /api/departments/{id} | Get a specific departments by ID
[**departments_list**](DepartmentsApi.md#departments_list) | **GET** /api/departments | List all departments
[**departments_update**](DepartmentsApi.md#departments_update) | **PUT** /api/departments/{id} | Update an existing departments


# **departments_create**
> object departments_create(body)

Create a new departments

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
    api_instance = glapi.DepartmentsApi(api_client)
    body = None # object | 

    try:
        # Create a new departments
        api_response = api_instance.departments_create(body)
        print("The response of DepartmentsApi->departments_create:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DepartmentsApi->departments_create: %s\n" % e)
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

# **departments_delete**
> object departments_delete(id)

Delete a departments

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
    api_instance = glapi.DepartmentsApi(api_client)
    id = UUID('38400000-8cf0-11bd-b23e-10b96e4ef00d') # UUID | departments ID

    try:
        # Delete a departments
        api_response = api_instance.departments_delete(id)
        print("The response of DepartmentsApi->departments_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DepartmentsApi->departments_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **UUID**| departments ID | 

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

# **departments_get**
> object departments_get(id)

Get a specific departments by ID

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
    api_instance = glapi.DepartmentsApi(api_client)
    id = UUID('38400000-8cf0-11bd-b23e-10b96e4ef00d') # UUID | departments ID

    try:
        # Get a specific departments by ID
        api_response = api_instance.departments_get(id)
        print("The response of DepartmentsApi->departments_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DepartmentsApi->departments_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **UUID**| departments ID | 

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

# **departments_list**
> object departments_list()

List all departments

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
    api_instance = glapi.DepartmentsApi(api_client)

    try:
        # List all departments
        api_response = api_instance.departments_list()
        print("The response of DepartmentsApi->departments_list:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DepartmentsApi->departments_list: %s\n" % e)
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

# **departments_update**
> object departments_update(id, body)

Update an existing departments

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
    api_instance = glapi.DepartmentsApi(api_client)
    id = UUID('38400000-8cf0-11bd-b23e-10b96e4ef00d') # UUID | departments ID
    body = None # object | 

    try:
        # Update an existing departments
        api_response = api_instance.departments_update(id, body)
        print("The response of DepartmentsApi->departments_update:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DepartmentsApi->departments_update: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **UUID**| departments ID | 
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

