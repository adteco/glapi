# glapi.CustomersApi

All URIs are relative to *http://localhost:3031/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**customers_create**](CustomersApi.md#customers_create) | **POST** /api/customers | Create a new customers
[**customers_delete**](CustomersApi.md#customers_delete) | **DELETE** /api/customers/{id} | Delete a customers
[**customers_get**](CustomersApi.md#customers_get) | **GET** /api/customers/{id} | Get a specific customers by ID
[**customers_list**](CustomersApi.md#customers_list) | **GET** /api/customers | List all customers
[**customers_update**](CustomersApi.md#customers_update) | **PUT** /api/customers/{id} | Update an existing customers


# **customers_create**
> object customers_create(body)

Create a new customers

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
    api_instance = glapi.CustomersApi(api_client)
    body = None # object | 

    try:
        # Create a new customers
        api_response = api_instance.customers_create(body)
        print("The response of CustomersApi->customers_create:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CustomersApi->customers_create: %s\n" % e)
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

# **customers_delete**
> object customers_delete(id)

Delete a customers

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
    api_instance = glapi.CustomersApi(api_client)
    id = UUID('38400000-8cf0-11bd-b23e-10b96e4ef00d') # UUID | customers ID

    try:
        # Delete a customers
        api_response = api_instance.customers_delete(id)
        print("The response of CustomersApi->customers_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CustomersApi->customers_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **UUID**| customers ID | 

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

# **customers_get**
> object customers_get(id)

Get a specific customers by ID

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
    api_instance = glapi.CustomersApi(api_client)
    id = UUID('38400000-8cf0-11bd-b23e-10b96e4ef00d') # UUID | customers ID

    try:
        # Get a specific customers by ID
        api_response = api_instance.customers_get(id)
        print("The response of CustomersApi->customers_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CustomersApi->customers_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **UUID**| customers ID | 

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

# **customers_list**
> object customers_list()

List all customers

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
    api_instance = glapi.CustomersApi(api_client)

    try:
        # List all customers
        api_response = api_instance.customers_list()
        print("The response of CustomersApi->customers_list:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CustomersApi->customers_list: %s\n" % e)
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

# **customers_update**
> object customers_update(id, body)

Update an existing customers

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
    api_instance = glapi.CustomersApi(api_client)
    id = UUID('38400000-8cf0-11bd-b23e-10b96e4ef00d') # UUID | customers ID
    body = None # object | 

    try:
        # Update an existing customers
        api_response = api_instance.customers_update(id, body)
        print("The response of CustomersApi->customers_update:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CustomersApi->customers_update: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **UUID**| customers ID | 
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

