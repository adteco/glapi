# glapi.SubsidiariesApi

All URIs are relative to *http://localhost:3031/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**subsidiaries_create**](SubsidiariesApi.md#subsidiaries_create) | **POST** /api/subsidiaries | Create a new subsidiaries
[**subsidiaries_delete**](SubsidiariesApi.md#subsidiaries_delete) | **DELETE** /api/subsidiaries/{id} | Delete a subsidiaries
[**subsidiaries_get**](SubsidiariesApi.md#subsidiaries_get) | **GET** /api/subsidiaries/{id} | Get a specific subsidiaries by ID
[**subsidiaries_list**](SubsidiariesApi.md#subsidiaries_list) | **GET** /api/subsidiaries | List all subsidiaries
[**subsidiaries_update**](SubsidiariesApi.md#subsidiaries_update) | **PUT** /api/subsidiaries/{id} | Update an existing subsidiaries


# **subsidiaries_create**
> object subsidiaries_create(body)

Create a new subsidiaries

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
    api_instance = glapi.SubsidiariesApi(api_client)
    body = None # object | 

    try:
        # Create a new subsidiaries
        api_response = api_instance.subsidiaries_create(body)
        print("The response of SubsidiariesApi->subsidiaries_create:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SubsidiariesApi->subsidiaries_create: %s\n" % e)
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

# **subsidiaries_delete**
> object subsidiaries_delete(id)

Delete a subsidiaries

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
    api_instance = glapi.SubsidiariesApi(api_client)
    id = UUID('38400000-8cf0-11bd-b23e-10b96e4ef00d') # UUID | subsidiaries ID

    try:
        # Delete a subsidiaries
        api_response = api_instance.subsidiaries_delete(id)
        print("The response of SubsidiariesApi->subsidiaries_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SubsidiariesApi->subsidiaries_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **UUID**| subsidiaries ID | 

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

# **subsidiaries_get**
> object subsidiaries_get(id)

Get a specific subsidiaries by ID

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
    api_instance = glapi.SubsidiariesApi(api_client)
    id = UUID('38400000-8cf0-11bd-b23e-10b96e4ef00d') # UUID | subsidiaries ID

    try:
        # Get a specific subsidiaries by ID
        api_response = api_instance.subsidiaries_get(id)
        print("The response of SubsidiariesApi->subsidiaries_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SubsidiariesApi->subsidiaries_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **UUID**| subsidiaries ID | 

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

# **subsidiaries_list**
> object subsidiaries_list()

List all subsidiaries

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
    api_instance = glapi.SubsidiariesApi(api_client)

    try:
        # List all subsidiaries
        api_response = api_instance.subsidiaries_list()
        print("The response of SubsidiariesApi->subsidiaries_list:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SubsidiariesApi->subsidiaries_list: %s\n" % e)
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

# **subsidiaries_update**
> object subsidiaries_update(id, body)

Update an existing subsidiaries

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
    api_instance = glapi.SubsidiariesApi(api_client)
    id = UUID('38400000-8cf0-11bd-b23e-10b96e4ef00d') # UUID | subsidiaries ID
    body = None # object | 

    try:
        # Update an existing subsidiaries
        api_response = api_instance.subsidiaries_update(id, body)
        print("The response of SubsidiariesApi->subsidiaries_update:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SubsidiariesApi->subsidiaries_update: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **UUID**| subsidiaries ID | 
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

