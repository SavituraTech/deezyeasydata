from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model
from django.db.models import Q

User = get_user_model()


class PhoneOrUsernameBackend(ModelBackend):
    """
    Authenticate by username / phone / email (case-insensitive, trimmed).
    Parity with dbn-backend/apps/users/backends.py.
    """

    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None:
            username = kwargs.get(User.USERNAME_FIELD)
        if username is None:
            return None
        raw = str(username).strip()
        if not raw:
            return None
        try:
            user = User.objects.get(
                Q(username__iexact=raw)
                | Q(phone=raw)
                | Q(phone=raw.replace(" ", ""))
                | Q(email__iexact=raw)
            )
        except User.DoesNotExist:
            return None
        except User.MultipleObjectsReturned:
            user = (
                User.objects.filter(username__iexact=raw).first()
                or User.objects.filter(phone=raw).first()
                or User.objects.filter(email__iexact=raw).first()
            )
            if user is None:
                return None
        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None
