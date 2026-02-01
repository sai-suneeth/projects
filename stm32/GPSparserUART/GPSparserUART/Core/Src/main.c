/* USER CODE BEGIN Header */
/**
  ******************************************************************************
  * @file           : main.c
  * @brief          : Main program body
  ******************************************************************************
  * @attention
  *
  * Copyright (c) 2024 STMicroelectronics.
  * All rights reserved.
  *
  * This software is licensed under terms that can be found in the LICENSE file
  * in the root directory of this software component.
  * If no LICENSE file comes with this software, it is provided AS-IS.
  *
  ******************************************************************************
  */
/* USER CODE END Header */
/* Includes ------------------------------------------------------------------*/
#include "main.h"
#include "usb_device.h"

/* Private includes ----------------------------------------------------------*/
/* USER CODE BEGIN Includes */
#include "NMEA.h"
#include "UartRingbuffer.h"
#include <string.h>
#include <stdio.h>
#include "usbd_cdc_if.h"
/* USER CODE END Includes */

/* Private typedef -----------------------------------------------------------*/
/* USER CODE BEGIN PTD */

/* USER CODE END PTD */

/* Private define ------------------------------------------------------------*/
/* USER CODE BEGIN PD */
/* USER CODE END PD */

/* Private macro -------------------------------------------------------------*/
/* USER CODE BEGIN PM */

/* USER CODE END PM */

/* Private variables ---------------------------------------------------------*/
UART_HandleTypeDef huart1;
UART_HandleTypeDef huart2;

/* USER CODE BEGIN PV */
ring_buffer buffer;
char nmea_message[NMEA_MAX_MESSAGE_SIZE];
NMEA_Data data;
char message[NMEA_MAX_MESSAGE_SIZE];
char dupe[NMEA_MAX_MESSAGE_SIZE];
char dupe1[NMEA_MAX_MESSAGE_SIZE];
int count=0;
int problem1=0;
/* USER CODE END PV */

/* Private function prototypes -----------------------------------------------*/
void SystemClock_Config(void);
static void MX_GPIO_Init(void);
static void MX_USART2_UART_Init(void);
static void MX_USART1_UART_Init(void);
/* USER CODE BEGIN PFP */

/* USER CODE END PFP */

/* Private user code ---------------------------------------------------------*/
/* USER CODE BEGIN 0 */
void read_buffer(unsigned char c, ring_buffer *buffer, char *nmea_message);


void Error_Handler(void)
{

  while (1)
  {
    problem1++;
  }
}


void HAL_UART_RxCpltCallback(UART_HandleTypeDef *huart)
{
  if (huart == &huart2)
  {
    unsigned char c = huart->Instance->DR;


    if (HAL_UART_Receive_IT(huart, (uint8_t *)&buffer.buffer[buffer.head], 1) != HAL_OK)
    {

      Error_Handler();
    }




    read_buffer(c, &buffer, nmea_message);
  }
}

void doubleToString(double value, char *str)
{
  snprintf(str, 20, "%.7f", value);
}


void read_buffer(unsigned char c, ring_buffer *buffer, char *nmea_message)
{
  if (c == '$')
  {
    buffer->head = 0;
    buffer->tail = 0;

    nmea_message[buffer->head++] = c;
    buffer->storing = 1;

  }
  else if (buffer->storing)
  {
    buffer->buffer[buffer->head] = c;
    buffer->head = (buffer->head + 1) % UART_BUFFER_SIZE;

    if (c == '*')
    {
      buffer->storing = 0;

      nmea_message[buffer->head] = '\0';  //NMEA is useless here directly go for message

      strcpy(message, (char *)buffer->buffer);



      parseNMEAGGA(message, &data, dupe);
      parseNMEAGSV(message, &data, dupe1);
      count++;


      char buffer1[500];


           buffer1[0] = '\0';


               snprintf(buffer1 + strlen(buffer1), sizeof(buffer1) - strlen(buffer1), "GPS Position: %c\r\n", data.gpsposition);

   //timestamp
               char buffer2[20];
               doubleToString(data.timestamp,buffer2);
               snprintf(buffer1 + strlen(buffer1), sizeof(buffer1) - strlen(buffer1), "Timestamp: %s\r\n",buffer2);
               buffer2[0] = '\0';

    //latitude
               doubleToString(data.latitude, buffer2);
               snprintf(buffer1 + strlen(buffer1), sizeof(buffer1) - strlen(buffer1), "latitude: %s\r\n", buffer2);
               buffer2[0] = '\0';

  //Northorsouth
               snprintf(buffer1 + strlen(buffer1), sizeof(buffer1) - strlen(buffer1), "Northorsouth: %d\r\n", data.Northorsouth);


   //longitude
               doubleToString(data.longitude, buffer2);
               snprintf(buffer1 + strlen(buffer1), sizeof(buffer1) - strlen(buffer1), "longitude: %s\r\n", buffer2);
               buffer2[0] = '\0';

   //eastorwest
               snprintf(buffer1 + strlen(buffer1), sizeof(buffer1) - strlen(buffer1), "eastorwest: %d\r\n", data.eastorwest);

   //fixtype
               snprintf(buffer1 + strlen(buffer1), sizeof(buffer1) - strlen(buffer1), "fixtype %c'\r\n", data.fix_type);

   // satellites
               doubleToString(data.satellites, buffer2);
               snprintf(buffer1 + strlen(buffer1), sizeof(buffer1) - strlen(buffer1), "satelites: %s\r\n", buffer2);
               buffer2[0] = '\0';

   //hdop
               doubleToString(data.hdop, buffer2);
               snprintf(buffer1 + strlen(buffer1), sizeof(buffer1) - strlen(buffer1), "hdop: %s\r\n", buffer2);
               buffer2[0] = '\0';

   //altitude
               doubleToString(data.altitude, buffer2);
               snprintf(buffer1 + strlen(buffer1), sizeof(buffer1) - strlen(buffer1), "altitude: %s\r\n", buffer2);
               buffer2[0] = '\0';
   //VDOP
               doubleToString(data.altitude, buffer2);
               snprintf(buffer1 + strlen(buffer1), sizeof(buffer1) - strlen(buffer1), "VDOP: %s\r\n", buffer2);
               buffer2[0] = '\0';

CDC_Transmit_FS((uint8_t *)buffer1, strlen(buffer1));


              buffer->head = 0;
              buffer->tail = 0;


    }

  }
}
/* USER CODE END 0 */

/**
  * @brief  The application entry point.
  * @retval int
  */
int main(void)
{
  /* USER CODE BEGIN 1 */
  /* USER CODE END 1 */

  /* MCU Configuration--------------------------------------------------------*/

  /* Reset of all peripherals, Initializes the Flash interface and the Systick. */
  HAL_Init();

  /* USER CODE BEGIN Init */

  /* USER CODE END Init */

  /* Configure the system clock */
  SystemClock_Config();

  /* USER CODE BEGIN SysInit */

  /* USER CODE END SysInit */

  /* Initialize all configured peripherals */
  MX_GPIO_Init();
  MX_USB_DEVICE_Init();
  MX_USART2_UART_Init();
  MX_USART1_UART_Init();
  /* USER CODE BEGIN 2 */


  if (HAL_UART_Receive_IT(&huart2, (uint8_t *)&buffer.buffer[buffer.head], 1) != HAL_OK)
  {

    Error_Handler();
  }

  /* USER CODE END 2 */

  /* Infinite loop */
  /* USER CODE BEGIN WHILE */
  while (1)
  {
    /* USER CODE END WHILE */

    /* USER CODE BEGIN 3 */
    // Place your code here

  }
  /* USER CODE END 3 */
}

/**
  * @brief System Clock Configuration
  * @retval None
  */
void SystemClock_Config(void)
{
  RCC_OscInitTypeDef RCC_OscInitStruct = {0};
  RCC_ClkInitTypeDef RCC_ClkInitStruct = {0};

  /** Configure the main internal regulator output voltage
  */
  __HAL_RCC_PWR_CLK_ENABLE();
  __HAL_PWR_VOLTAGESCALING_CONFIG(PWR_REGULATOR_VOLTAGE_SCALE2);

  /** Initializes the RCC Oscillators according to the specified parameters
  * in the RCC_OscInitTypeDef structure.
  */
  RCC_OscInitStruct.OscillatorType = RCC_OSCILLATORTYPE_HSI | RCC_OSCILLATORTYPE_HSE;
  RCC_OscInitStruct.HSEState = RCC_HSE_ON;
  RCC_OscInitStruct.HSIState = RCC_HSI_ON;
  RCC_OscInitStruct.HSICalibrationValue = RCC_HSICALIBRATION_DEFAULT;
  RCC_OscInitStruct.PLL.PLLState = RCC_PLL_ON;
  RCC_OscInitStruct.PLL.PLLSource = RCC_PLLSOURCE_HSE;
  RCC_OscInitStruct.PLL.PLLM = 15;
  RCC_OscInitStruct.PLL.PLLN = 144;
  RCC_OscInitStruct.PLL.PLLP = RCC_PLLP_DIV2;
  RCC_OscInitStruct.PLL.PLLQ = 5;
  if (HAL_RCC_OscConfig(&RCC_OscInitStruct) != HAL_OK)
  {
    Error_Handler();
  }

  /** Initializes the CPU, AHB and APB buses clocks
  */
  RCC_ClkInitStruct.ClockType = RCC_CLOCKTYPE_HCLK | RCC_CLOCKTYPE_SYSCLK |
                                RCC_CLOCKTYPE_PCLK1 | RCC_CLOCKTYPE_PCLK2;
  RCC_ClkInitStruct.SYSCLKSource = RCC_SYSCLKSOURCE_HSI;
  RCC_ClkInitStruct.AHBCLKDivider = RCC_SYSCLK_DIV1;
  RCC_ClkInitStruct.APB1CLKDivider = RCC_HCLK_DIV1;
  RCC_ClkInitStruct.APB2CLKDivider = RCC_HCLK_DIV1;

  if (HAL_RCC_ClockConfig(&RCC_ClkInitStruct, FLASH_LATENCY_0) != HAL_OK)
  {
    Error_Handler();
  }
}

/**
  * @brief USART1 Initialization Function
  * @param None
  * @retval None
  */
static void MX_USART1_UART_Init(void)
{
  huart1.Instance = USART1;
  huart1.Init.BaudRate = 9600;
  huart1.Init.WordLength = UART_WORDLENGTH_8B;
  huart1.Init.StopBits = UART_STOPBITS_1;
  huart1.Init.Parity = UART_PARITY_NONE;
  huart1.Init.Mode = UART_MODE_TX_RX;
  huart1.Init.HwFlowCtl = UART_HWCONTROL_NONE;
  huart1.Init.OverSampling = UART_OVERSAMPLING_16;
  if (HAL_UART_Init(&huart1) != HAL_OK)
  {
    Error_Handler();
  }
}

/**
  * @brief USART2 Initialization Function
  * @param None
  * @retval None
  */
static void MX_USART2_UART_Init(void)
{
  huart2.Instance = USART2;
  huart2.Init.BaudRate = 9600;
  huart2.Init.WordLength = UART_WORDLENGTH_8B;
  huart2.Init.StopBits = UART_STOPBITS_1;
  huart2.Init.Parity = UART_PARITY_NONE;
  huart2.Init.Mode = UART_MODE_TX_RX;
  huart2.Init.HwFlowCtl = UART_HWCONTROL_NONE;
  huart2.Init.OverSampling = UART_OVERSAMPLING_16;
  if (HAL_UART_Init(&huart2) != HAL_OK)
  {
    Error_Handler();
  }
}

/**
  * @brief GPIO Initialization Function
  * @param None
  * @retval None
  */
static void MX_GPIO_Init(void)
{
  /* GPIO Ports Clock Enable */
  __HAL_RCC_GPIOH_CLK_ENABLE();
  __HAL_RCC_GPIOA_CLK_ENABLE();
  __HAL_RCC_GPIOB_CLK_ENABLE();
}

/* USER CODE BEGIN 4 */

/* USER CODE END 4 */

#ifdef USE_FULL_ASSERT
/**
  * @brief  Reports the name of the source file and the source line number
  *         where the assert_param error has occurred.
  * @param  file: pointer to the source file name
  * @param  line: assert_param error line source number
  * @retval None
  */
void assert_failed(uint8_t *file, uint32_t line)
{
  /* USER CODE BEGIN 6 */
  /* User can add his own implementation to report the file name and line number,
    ex: printf("Wrong parameters value: file %s on line %d\r\n", file, line) */
  /* USER CODE END 6 */
}
#endif /* USE_FULL_ASSERT */

