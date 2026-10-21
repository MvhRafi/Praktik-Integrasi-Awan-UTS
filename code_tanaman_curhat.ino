#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>

//setup wifi 
const char* WIFI_SSID     = "";
const char* WIFI_PASSWORD = "";

//url best api supabase
const char* SUPABASE_URL = "";

//menggunakan publishable anon key
const char* SUPABASE_KEY = "";

const char* SUPABASE_SECKEY = "";

//variable data dumy
int kelembapan = 100;
int cahaya = 850;
int debit_air = 100;

//ritme loop dalam milis (non blocking)
unsigned long lastSendTime = 0;
const unsigned long sendInterval = 10000;

void setup() {
  // put your setup code here, to run once:
  Serial.begin(115200);
  delay(1000);

  Serial.println("Akses Sistem Pemantauan Tanaman");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("Menghubungkan ke WiFi!");
  while (WiFi.status() != WL_CONNECTED) {
    delay(100);
    Serial.print(".");
  }

  Serial.println("\nTerhubung ke WiFi");
  Serial.print("IP Addres = ");
  Serial.println(WiFi.localIP());
}

void loop() {
  // put your main code here, to run repeatedly:
  checkWaterCommand();

  if(millis() - lastSendTime >= sendInterval) {
    lastSendTime = millis();

    kelembapan -= 10;
    // debit_air -= 10;

    if (kelembapan < 5) kelembapan = 5;
    // if (debit_air < 5) debit_air = 5;

    cahaya = random(400, 950);

    String suasana;
    String curhatan;
    
    //Suasana/mood dari tanaman berdasarkan dari paramter kelembapan dan cahaya yang menyinari
    if (kelembapan > 70) {
      suasana = "Segar dan Senang! 🌿";
      curhatan = "Udah kenyang minum, makasih ya! Aku makin segar hari ini.";
    } else if (kelembapan >= 30 && kelembapan <= 70) {
      suasana = "Mulai Haus 🙂";
      curhatan = "Tenggorokanku agak kering nih... Jangan lupa siram aku nanti ya.";
    } else {
      suasana = "Sangat Haus! 😭";
      curhatan = "Tolonggg!! Aku haus banget, daunku udah mulai layu dan lemas!";
    }

    // Kirim data ke Supabase
    sendToSupabase(kelembapan, cahaya, debit_air, suasana, curhatan);
  }
}

void sendToSupabase(int hum, int lux, int debit, String mood, String msg) {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure client;
  client.setInsecure(); //digunakan untuk mengabaikan verifikasi SSL   

  HTTPClient http;
  String endpoint = String(SUPABASE_URL) + "/rest/v1/kondisi_tanaman";

  http.begin(client, endpoint);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_SECKEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_SECKEY);
  http.addHeader("Prefer", "return=minimal");

  // Buat Payload JSON
  StaticJsonDocument<256> doc;
  doc["kelembapan"] = hum;
  doc["cahaya"] = lux;
  doc["debit_air"] = debit;
  doc["suasana_hati"] = mood;
  doc["curhatan"] = msg;

  String jsonPayload;
  serializeJson(doc, jsonPayload);

  int httpCode = http.POST(jsonPayload);
  if (httpCode >= 200 && httpCode < 300) {
    Serial.printf("[POST OK] Data terkirim! Kelembapan: %d%% | Debit: %d%%  Mood: %s\n", hum, debit, mood.c_str());
  } else {
    Serial.printf("[POST ERROR] Gagal kirim! HTTP Code: %d\n", httpCode);
  }

  http.end();
}

//fungsi untukcek eksekusi perintah siram dari UI
void checkWaterCommand() {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure client;
  client.setInsecure(); 
  
  HTTPClient http;
  String endpoint = String(SUPABASE_URL) + "/rest/v1/perintah?status=eq.PENDING&aksi=eq.SIRAM&select=*";

  http.begin(client, endpoint);
  http.addHeader("apikey", SUPABASE_SECKEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_SECKEY);

  int httpCode = http.GET();
  if (httpCode == 200) {
    String response = http.getString();

    DynamicJsonDocument doc(1024);
    deserializeJson(doc, response);

    // Jika ada perintah pending
    if (doc.as<JsonArray>().size() > 0) {
      Serial.println("\n[SISTEM] Perintah SIRAM Diterima dari GUI!");
      
      // Reset kelembapan dummy kembali segar (100%)
      onWaterCommandService();
      Serial.println("[ACTION] Tanaman berhasil disiram! Kelembapan kembali 100%.");

      // Update status perintah menjadi DONE
      updateCommandStatus();
    }
  }
  http.end();
}

void onWaterCommandService() {
  kelembapan = 100;

  debit_air -= 15;
  if (debit_air < 0) {
    debit_air = 0;
  }
  Serial.printf("[ACTION] Penyiraman berhasil! Kelembapan: 100%% | Sisa Debit Air Teko: %d%%\n", debit_air);
}

//fungsi update status perintah dari pending menjadi done
void updateCommandStatus() {
  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  String endpoint = String(SUPABASE_URL) + "/rest/v1/perintah?status=eq.PENDING&aksi=eq.SIRAM";

  http.begin(client, endpoint);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_SECKEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_SECKEY);

  String patchPayload = "{\"status\":\"DONE\"}";
  int httpCode = http.PATCH(patchPayload);

  if (httpCode >= 200 && httpCode < 300) {
    Serial.println("[PATCH OK] Status perintah diperbarui menjadi 'DONE'.\n");
  } else {
    Serial.printf("[PATCH ERROR] Gagal update status perintah. HTTP Code: %d\n", httpCode);
  }
  http.end();
}
