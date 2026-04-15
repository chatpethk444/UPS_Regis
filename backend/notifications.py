from exponent_server_sdk import PushClient, PushMessage, PushServerError, PushTicketError
from requests.exceptions import ConnectionError, HTTPError

def send_push_message(token, title, message, extra=None):
    if not token or not token.startswith("ExponentPushToken"):
        return False # เช็คก่อนว่า Token ถูกฟอร์แมตไหม

    try:
        response = PushClient().publish(
            PushMessage(
                to=token,
                title=title,
                body=message,
                data=extra if extra else {}, # สามารถส่ง data แฝงไปได้ เช่น {"course_id": "CS101"}
                sound="default"
            )
        )
        return True
    except (PushServerError, PushTicketError, ConnectionError, HTTPError) as exc:
        # เก็บ Log error ไว้
        print(f"Error sending push notification: {exc}")
        return False