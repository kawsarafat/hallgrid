// Copy this file to config.h and fill in the values for one node.
// config.h is ignored by git so passwords and keys stay out of the repository.

#pragma once

// ROLE_WING   : wing distribution board. Meter + corridor daylight relay + washroom PIR relay.
// ROLE_COMMON : common/pump board. Meter + roof-tank level sensor + pump contactor relay.
#define NODE_ROLE ROLE_WING

// Must match an entry in NODE_KEYS on the server, e.g. "f1-north", "f2-south", "common".
#define NODE_ID "f1-north"
#define NODE_KEY "change-me"

#define WIFI_SSID "your-hall-wifi"
#define WIFI_PASS "your-password"

#define API_URL "https://hallgrid-bd.vercel.app/api/telemetry"

// Optional: PEM of the root certificate that signs API_URL's TLS certificate.
// Without it the node encrypts traffic but does not verify the server.
// #define ROOT_CA_PEM "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----\n"

// Most 5 V relay boards sold locally switch on when the input is LOW.
#define RELAY_ACTIVE_LOW 1

// LDR module: set to 1 if the analog output rises when it gets darker.
#define LDR_DARK_IS_HIGH 1
// Calibrate on site from the "bright" value in the serial summary, at dusk and midday.
#define LDR_BRIGHT_OFF 2600  // above this for 10 min: daylight, corridor lights off
#define LDR_DARK_ON 2000     // below this for 2 min: dark, corridor lights on

// Roof tank, measured from the sensor face (ROLE_COMMON only).
// The JSN-SR04T cannot see closer than about 25 cm, so mount it at least 30 cm
// above the overflow level.
#define TANK_FULL_CM 35    // distance when water is at the overflow level
#define TANK_EMPTY_CM 185  // distance when the tank is empty
