Image rules for LLM vision:
- Accepted MIME types: image/jpeg, image/png, image/webp only — transcode others first
- For animated images extract frame 1 only
- Resize before encoding — avoid multi-MB base64 payloads (backend resizes to max 1600px PNG)
- Don't send blank or solid-colour images
