import bcrypt


def _to_bytes(value: str) -> bytes:
    return value.encode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(_to_bytes(plain_password), _to_bytes(hashed_password))


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(_to_bytes(password), salt).decode("utf-8")
