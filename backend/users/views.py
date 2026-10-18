from rest_framework import status, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView
from drf_spectacular.utils import extend_schema, OpenApiExample

from django.contrib.auth import get_user_model

from .serializers import (
    ProfileUpdateSerializer,
    UserSerializer,
    UserCreateSerializer,
    ChangePasswordSerializer,
    UpdateProfileSerializer,
)


class RegisterView(generics.CreateAPIView):
    """
    Register a new user account. Returns {success, data:{user, tokens}} envelope (DBN parity).
    """

    serializer_class = UserCreateSerializer
    permission_classes = [AllowAny]

    @extend_schema(
        examples=[
            OpenApiExample(
                "Register Request",
                value={
                    "username": "johndoe",
                    "email": "john@example.com",
                    "password": "securepassword123",
                    "password_confirm": "securepassword123",
                    "password2": "securepassword123",
                    "first_name": "John",
                    "last_name": "Doe",
                    "phone": "+2348012345678",
                },
            )
        ]
    )
    def create(self, request, *args, **kwargs):
        from rest_framework_simplejwt.tokens import RefreshToken
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "success": True,
                "data": {
                    "user": UserSerializer(user).data,
                    "tokens": {"refresh": str(refresh), "access": str(refresh.access_token)},
                },
            },
            status=status.HTTP_201_CREATED,
        )


class MeView(APIView):
    """
    Get current user profile.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(responses=UserSerializer)
    def get(self, request):
        """Get current user info."""
        return Response(UserSerializer(request.user).data)


class UpdateProfileView(APIView):
    """
    Update current user profile.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(request=UpdateProfileSerializer, responses=UserSerializer)
    def patch(self, request):
        """Update profile (first_name, last_name, phone)."""
        serializer = UpdateProfileSerializer(
            request.user, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(request.user).data)


class ChangePasswordView(APIView):
    """
    Change user password.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=ChangePasswordSerializer,
        responses={
            200: {"type": "object", "properties": {"message": {"type": "string"}}}
        },
    )
    def post(self, request):
        """Change password."""
        serializer = ChangePasswordSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)

        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save()

        return Response({"message": "Password updated successfully"})


class CustomTokenObtainPairView(TokenObtainPairView):
    """
    Custom login that returns {success, data:{user, tokens}} envelope (DBN parity) and tracks failed logins.
    """

    @extend_schema(
        examples=[
            OpenApiExample(
                "Login Request", value={"username": "admin", "password": "password123"}
            )
        ]
    )
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        username = request.data.get("username")
        User = get_user_model()

        if response.status_code != 200 and username:
            user = User.objects.filter(username=username).first()
            if user:
                user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
                user.save(update_fields=["failed_login_attempts"])
            # Normalize error envelope to DBN style
            response.data = {"success": False, "error": {"code": "INVALID_CREDENTIALS", "message": "Invalid username or password"}}

        if response.status_code == 200:
            user = User.objects.filter(username=username).first() if username else None
            if user:
                if not user.is_active:
                    return Response({"success": False, "error": {"code": "INACTIVE_USER", "message": "User account is inactive"}}, status=status.HTTP_403_FORBIDDEN)
                user.failed_login_attempts = 0
                user.save(update_fields=["failed_login_attempts"])
                response.data = {
                    "success": True,
                    "data": {"user": UserSerializer(user).data, "tokens": {"access": response.data.get("access"), "refresh": response.data.get("refresh")}},
                }

        return response


class ProfileView(APIView):
    """GET/PATCH current user profile with DBN-compatible envelope."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses=UserSerializer)
    @extend_schema(methods=["PATCH"], request=ProfileUpdateSerializer, responses=UserSerializer)
    def get(self, request):
        return Response({"success": True, "data": UserSerializer(request.user).data})

    def patch(self, request):
        from users.serializers import ProfileUpdateSerializer
        serializer = ProfileUpdateSerializer(request.user, data=request.data, partial=True, context={"request": request})
        if not serializer.is_valid():
            return Response({"success": False, "error": {"code": "VALIDATION_ERROR", "message": "Invalid input data", "details": serializer.errors}}, status=status.HTTP_400_BAD_REQUEST)
        user = serializer.save()
        return Response({"success": True, "data": UserSerializer(user).data})
