$base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
$bytes = [Convert]::FromBase64String($base64)
[IO.File]::WriteAllBytes("C:\Users\Joshan\OneDrive\Desktop\jpmnative\assets\transparent.png", $bytes)
Copy-Item "C:\Users\Joshan\OneDrive\Desktop\jpmnative\assets\transparent.png" -Destination "C:\Users\Joshan\OneDrive\Desktop\jpmnative\android\app\src\main\res\drawable-hdpi\splashscreen_logo.png" -Force
Copy-Item "C:\Users\Joshan\OneDrive\Desktop\jpmnative\assets\transparent.png" -Destination "C:\Users\Joshan\OneDrive\Desktop\jpmnative\android\app\src\main\res\drawable-mdpi\splashscreen_logo.png" -Force
Copy-Item "C:\Users\Joshan\OneDrive\Desktop\jpmnative\assets\transparent.png" -Destination "C:\Users\Joshan\OneDrive\Desktop\jpmnative\android\app\src\main\res\drawable-xhdpi\splashscreen_logo.png" -Force
Copy-Item "C:\Users\Joshan\OneDrive\Desktop\jpmnative\assets\transparent.png" -Destination "C:\Users\Joshan\OneDrive\Desktop\jpmnative\android\app\src\main\res\drawable-xxhdpi\splashscreen_logo.png" -Force
Copy-Item "C:\Users\Joshan\OneDrive\Desktop\jpmnative\assets\transparent.png" -Destination "C:\Users\Joshan\OneDrive\Desktop\jpmnative\android\app\src\main\res\drawable-xxxhdpi\splashscreen_logo.png" -Force
