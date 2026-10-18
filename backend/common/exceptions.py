"""
Custom exceptions for the Deezy Easy Data backend.
Parity with dbn-backend/apps/common/exceptions.py + DRF APIException compatibility.
"""

from rest_framework.exceptions import APIException
from rest_framework import status


class BaseAppException(Exception):
    default_message = "An error occurred"
    error_code = "UNKNOWN_ERROR"

    def __init__(self, message=None, error_code=None):
        self.message = message or self.default_message
        self.error_code = error_code or self.error_code
        super().__init__(self.message)


class InsufficientFundsException(APIException, BaseAppException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "Insufficient funds in wallet."
    default_code = "insufficient_funds"
    error_code = "INSUFFICIENT_FUNDS"


class WalletNotFoundException(BaseAppException):
    default_message = "Wallet not found"
    error_code = "WALLET_NOT_FOUND"


class ProductNotFoundException(APIException, BaseAppException):
    status_code = status.HTTP_404_NOT_FOUND
    default_detail = "Product not found."
    default_code = "product_not_found"
    error_code = "PRODUCT_NOT_FOUND"


class TransactionNotFoundException(BaseAppException):
    default_message = "Transaction not found"
    error_code = "TRANSACTION_NOT_FOUND"


class InvalidTransactionStateException(APIException, BaseAppException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "Invalid transaction state."
    default_code = "invalid_transaction_state"
    error_code = "INVALID_TRANSACTION_STATE"


class AmountLimitExceededException(APIException, BaseAppException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "Amount exceeds maximum allowed."
    default_code = "amount_limit_exceeded"
    error_code = "AMOUNT_LIMIT_EXCEEDED"


class MinBalanceException(BaseAppException):
    default_message = "Transaction would violate minimum wallet balance"
    error_code = "MIN_BALANCE_VIOLATION"


class ProviderException(APIException, BaseAppException):
    status_code = status.HTTP_502_BAD_GATEWAY
    default_detail = "Provider service unavailable."
    default_code = "provider_error"
    error_code = "PROVIDER_ERROR"


class ExternalProviderException(BaseAppException):
    default_message = "External provider error"
    error_code = "PROVIDER_ERROR"


class PaymentGatewayException(APIException, BaseAppException):
    status_code = status.HTTP_502_BAD_GATEWAY
    default_detail = "Payment gateway error."
    default_code = "payment_gateway_error"
    error_code = "PAYMENT_GATEWAY_ERROR"


class DuplicateTransactionException(BaseAppException):
    default_message = "Duplicate transaction detected"
    error_code = "DUPLICATE_TRANSACTION"


class InvalidPhoneNumberException(BaseAppException):
    default_message = "Invalid phone number format"
    error_code = "INVALID_PHONE_NUMBER"
