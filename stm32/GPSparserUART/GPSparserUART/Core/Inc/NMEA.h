/*
 * NMEA.h
 *
 *  Created on: Apr 3, 2024
 *      Author: sakku
 */

/*
 * NMEA.h
 *
 *  Created on: Apr 3, 2024
 *      Author: sakku
 */

#ifndef NMEA_H_
#define NMEA_H_

#include <stdint.h>

#define NMEA_MAX_MESSAGE_SIZE 100

typedef struct {
    char gpsposition;
    double timestamp;
    double latitude;      // decimal degrees
    char Northorsouth;
    double longitude;     // decimal degrees
    char eastorwest;
    char fix_type;
    double satellites;
    double hdop;
    double altitude;      // meters
    double VDOP;
} NMEA_Data;

void parseNMEAGGA(const char *message, NMEA_Data *data,char*dupe);
void parseNMEAGSV(const char *message, NMEA_Data *data,char*dupe1);



#endif /* NMEA_H_ */
