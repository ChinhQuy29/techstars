/*
 * Homework Lamp — Seeed XIAO ESP32S3 Sense firmware (stretch goal)
 *
 * Role: Wi-Fi camera + LED ring only. NO on-device OCR.
 *   GET  /stream            low-res MJPEG preview (for local-network demos)
 *   GET  /capture           one high-res JPEG
 *   GET  /led?state=...     off | idle | thinking | correct | hint | error
 * Optional push mode (avoids HTTPS mixed-content): POSTs preview JPEGs to
 *   BACKEND_URL/api/frame/<SESSION_ID>  (relayed to the screen over Socket.IO)
 *
 * Board: "XIAO_ESP32S3", PSRAM: "OPI PSRAM". Libraries: esp32-camera (bundled with
 * the ESP32 Arduino core), Adafruit_NeoPixel. Prefer the OV5640 module for handwriting.
 */
#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <Adafruit_NeoPixel.h>
#include "esp_camera.h"

// ---------- config ----------
const char* WIFI_SSID = "YOUR_WIFI";
const char* WIFI_PASS = "YOUR_PASSWORD";
const char* BACKEND_URL = "";          // e.g. "http://192.168.1.20:8000" — empty disables push mode
const char* SESSION_ID = "lamp01";     // must match the session shown on the screen
const uint32_t PUSH_INTERVAL_MS = 300; // ~3 fps preview push

#define LED_PIN 1      // D0 on XIAO ESP32S3
#define LED_COUNT 16   // WS2812 ring

// XIAO ESP32S3 Sense camera pins
#define PWDN_GPIO_NUM -1
#define RESET_GPIO_NUM -1
#define XCLK_GPIO_NUM 10
#define SIOD_GPIO_NUM 40
#define SIOC_GPIO_NUM 39
#define Y9_GPIO_NUM 48
#define Y8_GPIO_NUM 11
#define Y7_GPIO_NUM 12
#define Y6_GPIO_NUM 14
#define Y5_GPIO_NUM 16
#define Y4_GPIO_NUM 18
#define Y3_GPIO_NUM 17
#define Y2_GPIO_NUM 15
#define VSYNC_GPIO_NUM 38
#define HREF_GPIO_NUM 47
#define PCLK_GPIO_NUM 13

WebServer server(80);
Adafruit_NeoPixel ring(LED_COUNT, LED_PIN, NEO_GRB + NEO_KHZ800);
String ledState = "idle";
uint32_t lastPush = 0;

const framesize_t PREVIEW_SIZE = FRAMESIZE_VGA;   // 640x480
const framesize_t CAPTURE_SIZE = FRAMESIZE_QXGA;  // 2048x1536 (OV5640: up to 5MP)

bool initCamera() {
  camera_config_t c = {};
  c.ledc_channel = LEDC_CHANNEL_0;
  c.ledc_timer = LEDC_TIMER_0;
  c.pin_d0 = Y2_GPIO_NUM; c.pin_d1 = Y3_GPIO_NUM; c.pin_d2 = Y4_GPIO_NUM; c.pin_d3 = Y5_GPIO_NUM;
  c.pin_d4 = Y6_GPIO_NUM; c.pin_d5 = Y7_GPIO_NUM; c.pin_d6 = Y8_GPIO_NUM; c.pin_d7 = Y9_GPIO_NUM;
  c.pin_xclk = XCLK_GPIO_NUM; c.pin_pclk = PCLK_GPIO_NUM; c.pin_vsync = VSYNC_GPIO_NUM;
  c.pin_href = HREF_GPIO_NUM; c.pin_sccb_sda = SIOD_GPIO_NUM; c.pin_sccb_scl = SIOC_GPIO_NUM;
  c.pin_pwdn = PWDN_GPIO_NUM; c.pin_reset = RESET_GPIO_NUM;
  c.xclk_freq_hz = 20000000;
  c.pixel_format = PIXFORMAT_JPEG;
  c.frame_size = CAPTURE_SIZE;  // allocate buffers for the largest size
  c.jpeg_quality = 10;
  c.fb_count = 2;
  c.fb_location = CAMERA_FB_IN_PSRAM;
  c.grab_mode = CAMERA_GRAB_LATEST;
  if (esp_camera_init(&c) != ESP_OK) return false;
  esp_camera_sensor_get()->set_framesize(esp_camera_sensor_get(), PREVIEW_SIZE);
  return true;
}

// ---------- LED ring ----------
void fill(uint8_t r, uint8_t g, uint8_t b, uint8_t brightness = 255) {
  for (int i = 0; i < LED_COUNT; i++) ring.setPixelColor(i, ring.Color(r * brightness / 255, g * brightness / 255, b * brightness / 255));
  ring.show();
}

void updateLeds() {
  uint32_t t = millis();
  if (ledState == "off") fill(0, 0, 0);
  else if (ledState == "idle") fill(255, 220, 160, 180);                                 // warm desk light
  else if (ledState == "thinking") fill(40, 200, 255, 60 + (sin(t / 200.0) + 1) * 90);    // cyan pulse
  else if (ledState == "correct") fill(40, 255, 80);                                     // green
  else if (ledState == "hint") fill(170, 120, 255, 200);                                 // violet
  else if (ledState == "error") fill(255, 140, 0, (t / 300) % 2 ? 200 : 40);             // amber blink
}

// ---------- HTTP handlers ----------
void handleCapture() {
  sensor_t* s = esp_camera_sensor_get();
  s->set_framesize(s, CAPTURE_SIZE);
  for (int i = 0; i < 2; i++) { camera_fb_t* skip = esp_camera_fb_get(); if (skip) esp_camera_fb_return(skip); }
  camera_fb_t* fb = esp_camera_fb_get();
  s->set_framesize(s, PREVIEW_SIZE);
  if (!fb) { server.send(500, "text/plain", "capture failed"); return; }
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send_P(200, "image/jpeg", (const char*)fb->buf, fb->len);
  esp_camera_fb_return(fb);
}

void handleStream() {
  WiFiClient client = server.client();
  client.print("HTTP/1.1 200 OK\r\nAccess-Control-Allow-Origin: *\r\n"
               "Content-Type: multipart/x-mixed-replace; boundary=frame\r\n\r\n");
  while (client.connected()) {
    camera_fb_t* fb = esp_camera_fb_get();
    if (!fb) break;
    client.printf("--frame\r\nContent-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n", fb->len);
    client.write(fb->buf, fb->len);
    client.print("\r\n");
    esp_camera_fb_return(fb);
    updateLeds();
    delay(66);  // ~15 fps
  }
}

void handleLed() {
  ledState = server.arg("state");
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", "{\"ok\":true}");
}

// Push a frame to the backend relay (or a high-res capture with kind=capture).
void pushFrame(const char* kind) {
  if (strlen(BACKEND_URL) == 0) return;
  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) return;
  HTTPClient http;
  http.begin(String(BACKEND_URL) + "/api/frame/" + SESSION_ID + "?kind=" + kind);
  http.addHeader("Content-Type", "image/jpeg");
  http.POST(fb->buf, fb->len);
  http.end();
  esp_camera_fb_return(fb);
}

void setup() {
  Serial.begin(115200);
  ring.begin();
  fill(0, 0, 60);
  if (!initCamera()) { Serial.println("Camera init failed"); ledState = "error"; }
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) { delay(300); Serial.print("."); }
  Serial.printf("\nLamp ready: http://%s/\n", WiFi.localIP().toString().c_str());
  server.on("/capture", handleCapture);
  server.on("/stream", handleStream);
  server.on("/led", handleLed);
  server.begin();
}

void loop() {
  server.handleClient();
  updateLeds();
  if (millis() - lastPush > PUSH_INTERVAL_MS) {
    lastPush = millis();
    pushFrame("frame");
  }
}
