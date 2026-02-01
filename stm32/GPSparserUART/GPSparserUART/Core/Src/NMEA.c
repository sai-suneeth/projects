/*
 * NMEA.c
 *
 *  Created on: Apr 3, 2024
 *      Author: sakku
 */


#include "nmea.h"
#include <stdlib.h>
#include <string.h>

int size;

void parseNMEAGGA(const char *message, NMEA_Data *data,char *dupe)
{
    if (strncmp(message, "GPGGA", 5) == 0)
    {
        char NMEA_copy[strlen(message) + 1];

        strcpy(NMEA_copy, message);
        strcpy(dupe, NMEA_copy);

        //strtok(NMEA_copy, ",");

        data->gpsposition = *strtok(NMEA_copy, ",");                  //strtok(NULL, ",");
        data->timestamp = atof(strtok(NULL, ","));
        data->latitude = atof(strtok(NULL, ","));
        data->Northorsouth = *strtok(NULL, ",");
        data->longitude = atof(strtok(NULL, ","));
        data->eastorwest = *strtok(NULL, ",");
        data->fix_type = *strtok(NULL, ",");
        data->satellites = atof(strtok(NULL, ","));
        data->hdop = atof(strtok(NULL, ","));
        data->altitude = atof(strtok(NULL, ","));
    }
}
    void parseNMEAGSV(const char *message, NMEA_Data *data,char*dupe1)
	{
    	if (strncmp(message, "GPGSA", 5) == 0)

    {
        char NMEA_copy[strlen(message) + 1];
        strcpy(NMEA_copy, message);
        strcpy(dupe1, NMEA_copy);


        strtok(NMEA_copy, ",");
        for(int i=0;i<=16;i++)
        strtok(NULL, ",");

        data->VDOP = atof(strtok(NULL, ","));
        strtok(NULL, "*");

     }
}

