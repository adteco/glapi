# glapi.LeadsApi

All URIs are relative to *http://localhost:3031/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**leads_create**](LeadsApi.md#leads_create) | **POST** /api/leads | Create a new leads
[**leads_delete**](LeadsApi.md#leads_delete) | **DELETE** /api/leads/{id} | Delete a leads
[**leads_get**](LeadsApi.md#leads_get) | **GET** /api/leads/{id} | Get a specific leads by ID
[**leads_list**](LeadsApi.md#leads_list) | **GET** /api/leads | List all leads
[**leads_update**](LeadsApi.md#leads_update) | **PUT** /api/leads/{id} | Update an existing leads


# **leads_create**
> object leads_create(body)

Create a new leads

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
    api_instance = glapi.LeadsApi(api_client)
    body = None # object | 

    try:
        # Create a new leads
        api_response = api_instance.leads_create(body)
        print("The response of LeadsApi->leads_create:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling LeadsApi->leads_create: %s\n" % e)
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

# **leads_delete**
> object leads_delete(id)

Delete a leads

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
    api_instance = glapi.LeadsApi(api_client)
    id = UUID('38400000-8cf0-11bd-b23e-10b96e4ef00d') # UUID | leads ID

    try:
        # Delete a leads
        api_response = api_instance.leads_delete(id)
        print("The response of LeadsApi->leads_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling LeadsApi->leads_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **UUID**| leads ID | 

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

# **leads_get**
> object leads_get(id)

Get a specific leads by ID

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
    api_instance = glapi.LeadsApi(api_client)
    id = UUID('38400000-8cf0-11bd-b23e-10b96e4ef00d') # UUID | leads ID

    try:
        # Get a specific leads by ID
        api_response = api_instance.leads_get(id)
        print("The response of LeadsApi->leads_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling LeadsApi->leads_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **UUID**| leads ID | 

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

# **leads_list**
> object leads_list()

List all leads

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
    api_instance = glapi.LeadsApi(api_client)

    try:
        # List all leads
        api_response = api_instance.leads_list()
        print("The response of LeadsApi->leads_list:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling LeadsApi->leads_list: %s\n" % e)
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

# **leads_update**
> object leads_update(id, body)

Update an existing leads

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
    api_instance = glapi.LeadsApi(api_client)
    id = UUID('38400000-8cf0-11bd-b23e-10b96e4ef00d') # UUID | leads ID
    body = None # object | 

    try:
        # Update an existing leads
        api_response = api_instance.leads_update(id, body)
        print("The response of LeadsApi->leads_update:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling LeadsApi->leads_update: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **UUID**| leads ID | 
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

