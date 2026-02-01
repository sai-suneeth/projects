/*
 * UartRingbuffer.h
 *
 *  Created on: Apr 4, 2024
 *      Author: sakku
 */

#ifndef UART_RINGBUFFER_H
#define UART_RINGBUFFER_H

#include <stdint.h>

/******************* Ring Buffer Definition *******************/

#define UART_BUFFER_SIZE 80



typedef struct {
     uint8_t buffer[UART_BUFFER_SIZE];
     uint16_t head;
     uint16_t tail;
     uint16_t storing;


} ring_buffer;




#endif /* UART_RINGBUFFER_H */

