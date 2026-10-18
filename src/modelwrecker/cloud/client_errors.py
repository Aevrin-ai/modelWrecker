"""The errors a call to the cloud API can raise."""

from __future__ import annotations

from ..security.redaction import redact_text


class CloudError(Exception):
    """A call to the cloud API failed. `status` is None for network failures.

    `request_id` is the API's reference for the call, when it sent one. It is shown with the message
    so a person can quote it to support, and support can find the exact request in the API's logs.
    """

    def __init__(self, code: str, message: str = "", status: int | None = None,
                 request_id: str | None = None) -> None:
        self.code = code
        self.status = status
        self.request_id = request_id
        text = redact_text(message or code)
        self.message = f"{text} (request id {request_id})" if request_id else text
        super().__init__(self.message)

    @property
    def refused(self) -> bool:
        """True when the API answered and said no (a 4xx other than rate limiting or timeout).

        A network failure, a 5xx, a 408, or a 429 means "try again later", not a refusal.
        """
        status = self.status
        return status is not None and 400 <= status < 500 and status not in (408, 429)


class InsecureUrlError(CloudError):
    def __init__(self, message: str) -> None:
        super().__init__("insecure_url", message)
