#!/usr/bin/env python3
"""
GLAPI Python SDK - Quick Start Example

This example demonstrates basic usage of the GLAPI Python SDK.
"""

import os
import glapi
from glapi.rest import ApiException
from pprint import pprint


def main():
    # Configure the SDK with your authentication token
    configuration = glapi.Configuration(
        host="http://localhost:3031/api",  # or https://api.glapi.io/api for production
        access_token=os.environ.get("GLAPI_TOKEN", "your-clerk-token"),
    )

    # Create API client
    with glapi.ApiClient(configuration) as api_client:
        # =====================================================================
        # Example: Working with Customers
        # =====================================================================
        customers_api = glapi.CustomersApi(api_client)

        try:
            # List all customers
            print("Listing customers...")
            customers = customers_api.customers_list()
            print(f"Found {len(customers) if isinstance(customers, list) else 'unknown'} customers")
            pprint(customers)

        except ApiException as e:
            print(f"API Error: {e.status} - {e.reason}")
            if e.status == 401:
                print("Authentication required. Set GLAPI_TOKEN environment variable.")

        # =====================================================================
        # Example: Working with Vendors
        # =====================================================================
        vendors_api = glapi.VendorsApi(api_client)

        try:
            # Create a new vendor
            print("\nCreating vendor...")
            vendor_data = {
                "name": "Acme Corporation",
                "email": "billing@acme.example.com",
            }
            # Uncomment to create:
            # vendor = vendors_api.vendors_create(vendor_data)
            # print(f"Created vendor: {vendor}")

            # List vendors
            print("Listing vendors...")
            vendors = vendors_api.vendors_list()
            pprint(vendors)

        except ApiException as e:
            print(f"API Error: {e.status} - {e.reason}")

        # =====================================================================
        # Example: Working with Accounts (Chart of Accounts)
        # =====================================================================
        accounts_api = glapi.AccountsApi(api_client)

        try:
            print("\nListing accounts...")
            accounts = accounts_api.accounts_list()
            pprint(accounts)

        except ApiException as e:
            print(f"API Error: {e.status} - {e.reason}")


if __name__ == "__main__":
    main()
