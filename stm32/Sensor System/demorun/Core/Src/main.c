/* USER CODE BEGIN Header */
/**
  ******************************************************************************
  * @file           : main.c
  * @brief          : Main program body
  ******************************************************************************
  * @attention
  *
  * Copyright (c) 2025 STMicroelectronics.
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

/* Private includes ----------------------------------------------------------*/
/* USER CODE BEGIN Includes */
#include <string.h>
#include <stdio.h>
#include <math.h>
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
ADC_HandleTypeDef hadc1;
DMA_HandleTypeDef hdma_adc1;

UART_HandleTypeDef huart1;
UART_HandleTypeDef huart2;
DMA_HandleTypeDef hdma_usart1_rx;
DMA_HandleTypeDef hdma_usart1_tx;

/* USER CODE BEGIN PV */

uint8_t adcRunning = 0;
uint16_t adc_buffer[2];
int presence =0, isRxed=0;
uint8_t RxData[8], Temp_LSB=0, Temp_MSB=0;
float Temperature;
uint16_t Temp;
float VoMeasured = 0.0;
float calcVoltage = 0.0;
float dustDensity = 0.0;

const int samplingTime = 1;   // Approximation of 280 µs (rounded to 1 ms)
const int deltaTime    = 1;   // Approximation of 40 µs (rounded to 1 ms)
const int sleepTime    = 10;  // Approximation of 9.86 ms (rounded to 10 ms)
#define RL 10.0   // Load resistance in kΩ (typically 10kΩ)
#define RO_CLEAN_AIR 9.83  // Sensor resistance in clean air (calibration needed)
float adc_value, rs, ratio, ppm;
/* USER CODE END PV */

/* Private function prototypes -----------------------------------------------*/
void SystemClock_Config(void);
static void MX_GPIO_Init(void);
static void MX_DMA_Init(void);
static void MX_USART2_UART_Init(void);
static void MX_ADC1_Init(void);
static void MX_USART1_UART_Init(void);

/* USER CODE BEGIN PFP */

/* USER CODE END PFP */

/* Private user code ---------------------------------------------------------*/
/* USER CODE BEGIN 0 */

int __io_putchar(int ch)
{
    HAL_UART_Transmit(&huart2, (uint8_t *)&ch, 1, HAL_MAX_DELAY);
    return ch;
}

float Read_MQ135(void)
{
    uint32_t sum = 0;
    for (int i = 0; i < 10; i++)
    {

        sum += adc_buffer[1];
        HAL_Delay(10);
    }
    return (float)sum / 10.0f;
}

float Get_Rs(float adc_value)
{
    float Vrl = (adc_value / 4095.0f) * 3.3f;
    return (3.3f - Vrl) * RL / Vrl; // in kΩ
}

float Get_PPM(float ratio)
{
    // Approx. curve for CO2 (you can change constants for NH3, benzene, etc.)
    float a = 116.6020682;
    float b = -2.769034857;
    return a * pow(ratio, b);
}

void uart_Init (uint32_t baud)
{
	huart1.Instance = USART1;
	  huart1.Init.BaudRate = baud;
	  huart1.Init.WordLength = UART_WORDLENGTH_8B;
	  huart1.Init.StopBits = UART_STOPBITS_1;
	  huart1.Init.Parity = UART_PARITY_NONE;
	  huart1.Init.Mode = UART_MODE_TX_RX;
	  huart1.Init.HwFlowCtl = UART_HWCONTROL_NONE;
	  huart1.Init.OverSampling = UART_OVERSAMPLING_16;
	  if (HAL_HalfDuplex_Init(&huart1) != HAL_OK)
	  {
	    Error_Handler();
	  }
}

void DS18B20_write(uint8_t data)
{
    uint8_t buffer[8];
    for (int i = 0; i < 8; i++)
    {
        if (data & (1 << i))  // check i-th bit
            buffer[i] = 0xFF;
        else
            buffer[i] = 0x00;
    }
    HAL_UART_Transmit(&huart1, buffer, 8, 100);
}

uint8_t DS18B20_Read(void)
{
    uint8_t buffer[8];
    uint8_t value = 0;

    for (int i = 0; i < 8; i++)
        buffer[i] = 0xFF;

    isRxed = 0;
    HAL_UART_Receive_DMA(&huart1, RxData, 8);  // start DMA receive
    HAL_UART_Transmit(&huart1, buffer, 8, 100); // send read slots

    while (isRxed == 0); // wait for DMA complete

    for (int i = 0; i < 8; i++)
    {
        if (RxData[i] == 0xFF)
            value |= (1 << i);
    }

    return value;
}

int DS18B20_start(void)
{
    uint8_t data = 0xF0;

    uart_Init(9600);                   // 9600 baud for reset pulse
    HAL_UART_Transmit(&huart1, &data, 1, 100);

    if (HAL_UART_Receive(&huart1, &data, 1, 100) != HAL_OK)
        return -1;

    uart_Init(115200);                 // back to 115200 baud

    if (data == 0xF0) return -2;       // no presence pulse
    return 1;
}


void HAL_UART_RxCpltCallback(UART_HandleTypeDef *huart)
{
	isRxed =1;
}


void HAL_GPIO_EXTI_Callback(uint16_t GPIO_Pin)
{

	if(GPIO_Pin == GPIO_PIN_13)
	{
		HAL_GPIO_TogglePin(GPIOA,GPIO_PIN_5);
		adcRunning ^= 1;
		if (adcRunning){
			memset(adc_buffer, 0, sizeof(adc_buffer));
			HAL_ADC_Start_DMA(&hadc1,adc_buffer,2);

		}
		else{
			HAL_ADC_Stop_DMA(&hadc1);
		}
	}
}
//void HAL_ADC_ConvCpltCallback(ADC_HandleTypeDef* hadc)
//{
  //  if (hadc->Instance == ADC1)
    //{
      //  printf("ADC Values(PA6,PA7,PB0): %d, %d, %d\r\n",adc_buffer[0], adc_buffer[1], adc_buffer[2]);
    //}
//}

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
  MX_DMA_Init();
  MX_USART2_UART_Init();
  MX_ADC1_Init();
  MX_USART1_UART_Init();
  /* USER CODE BEGIN 2 */

  /* USER CODE END 2 */

  /* Infinite loop */
  /* USER CODE BEGIN WHILE */
  while (1)
  {
    /* USER CODE END WHILE */

    /* USER CODE BEGIN 3 */
	 if(!adcRunning)
	 {
		 presence =DS18B20_start();
		 	  		            	  DS18B20_write(0xCC);
		 	  		            	  DS18B20_write(0x44);

		 	  		            	  presence =DS18B20_start();
		 	  		            	  DS18B20_write(0xCC);
		 	  		            	  DS18B20_write(0xBE);
		 	  		            	//HAL_GPIO_TogglePin(GPIOA,GPIO_PIN_5);
		 	  		            	  Temp_LSB=DS18B20_Read();
		 	  		            	  Temp_MSB=DS18B20_Read();
		 	  		            	//HAL_GPIO_TogglePin(GPIOA,GPIO_PIN_5);
		 	  		            	  Temp= Temp_MSB<<8 | Temp_LSB;
		 	  		            	  Temperature =(float)Temp/16.0;
		 	  		            	  HAL_Delay(500);
		 	  		            	  printf("temperature:%f c\r\n",Temperature);

	 }
	 if (adcRunning)
	 		        {
		 	 	 	   HAL_GPIO_WritePin(GPIOA, GPIO_PIN_5, GPIO_PIN_RESET);
		               HAL_Delay(samplingTime);
		               uint16_t adcVal = adc_buffer[0];
		               HAL_Delay(deltaTime);
		               HAL_GPIO_WritePin(GPIOA, GPIO_PIN_5, GPIO_PIN_SET); // LED OFF
		               HAL_Delay(sleepTime);

		               VoMeasured = (float)adcVal;
		               calcVoltage = VoMeasured * (5.0f / 4096.0f);
		               dustDensity = 150.0f * calcVoltage - 50.0f;
		               adc_value = Read_MQ135(); // Read ADC value (0–4095)
		               rs = Get_Rs(adc_value);
		               ratio = rs / RO_CLEAN_AIR;
		               ppm = Get_PPM(ratio);
	 		           printf("ADC Values: [PA6]Dust Density: %f ug/m3 [PB0] %f   %d   bb %d \r\n",dustDensity,ppm,adc_buffer[0],adc_buffer[1]);
	 		           HAL_Delay(400);
	 		        }
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
  __HAL_PWR_VOLTAGESCALING_CONFIG(PWR_REGULATOR_VOLTAGE_SCALE3);

  /** Initializes the RCC Oscillators according to the specified parameters
  * in the RCC_OscInitTypeDef structure.
  */
  RCC_OscInitStruct.OscillatorType = RCC_OSCILLATORTYPE_HSI;
  RCC_OscInitStruct.HSIState = RCC_HSI_ON;
  RCC_OscInitStruct.HSICalibrationValue = RCC_HSICALIBRATION_DEFAULT;
  RCC_OscInitStruct.PLL.PLLState = RCC_PLL_NONE;
  if (HAL_RCC_OscConfig(&RCC_OscInitStruct) != HAL_OK)
  {
    Error_Handler();
  }

  /** Initializes the CPU, AHB and APB buses clocks
  */
  RCC_ClkInitStruct.ClockType = RCC_CLOCKTYPE_HCLK|RCC_CLOCKTYPE_SYSCLK
                              |RCC_CLOCKTYPE_PCLK1|RCC_CLOCKTYPE_PCLK2;
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
  * @brief ADC1 Initialization Function
  * @param None
  * @retval None
  */
static void MX_ADC1_Init(void)
{

  /* USER CODE BEGIN ADC1_Init 0 */

  /* USER CODE END ADC1_Init 0 */

  ADC_ChannelConfTypeDef sConfig = {0};

  /* USER CODE BEGIN ADC1_Init 1 */

  /* USER CODE END ADC1_Init 1 */

  /** Configure the global features of the ADC (Clock, Resolution, Data Alignment and number of conversion)
  */
  hadc1.Instance = ADC1;
  hadc1.Init.ClockPrescaler = ADC_CLOCK_SYNC_PCLK_DIV8;
  hadc1.Init.Resolution = ADC_RESOLUTION_12B;
  hadc1.Init.ScanConvMode = ENABLE;
  hadc1.Init.ContinuousConvMode = ENABLE;
  hadc1.Init.DiscontinuousConvMode = DISABLE;
  hadc1.Init.ExternalTrigConvEdge = ADC_EXTERNALTRIGCONVEDGE_NONE;
  hadc1.Init.ExternalTrigConv = ADC_SOFTWARE_START;
  hadc1.Init.DataAlign = ADC_DATAALIGN_RIGHT;
  hadc1.Init.NbrOfConversion = 2;
  hadc1.Init.DMAContinuousRequests = ENABLE;
  hadc1.Init.EOCSelection = ADC_EOC_SINGLE_CONV;
  if (HAL_ADC_Init(&hadc1) != HAL_OK)
  {
    Error_Handler();
  }

  /** Configure for the selected ADC regular channel its corresponding rank in the sequencer and its sample time.
  */
  sConfig.Channel = ADC_CHANNEL_6;
  sConfig.Rank = 1;
  sConfig.SamplingTime = ADC_SAMPLETIME_84CYCLES;
  if (HAL_ADC_ConfigChannel(&hadc1, &sConfig) != HAL_OK)
  {
    Error_Handler();
  }

  /** Configure for the selected ADC regular channel its corresponding rank in the sequencer and its sample time.
  */
  sConfig.Channel = ADC_CHANNEL_8;
  sConfig.Rank = 2;
  if (HAL_ADC_ConfigChannel(&hadc1, &sConfig) != HAL_OK)
  {
    Error_Handler();
  }
  /* USER CODE BEGIN ADC1_Init 2 */

  /* USER CODE END ADC1_Init 2 */

}

/**
  * @brief USART1 Initialization Function
  * @param None
  * @retval None
  */
static void MX_USART1_UART_Init(void)
{

  /* USER CODE BEGIN USART1_Init 0 */

  /* USER CODE END USART1_Init 0 */

  /* USER CODE BEGIN USART1_Init 1 */

  /* USER CODE END USART1_Init 1 */
  huart1.Instance = USART1;
  huart1.Init.BaudRate = 115200;
  huart1.Init.WordLength = UART_WORDLENGTH_8B;
  huart1.Init.StopBits = UART_STOPBITS_1;
  huart1.Init.Parity = UART_PARITY_NONE;
  huart1.Init.Mode = UART_MODE_TX_RX;
  huart1.Init.HwFlowCtl = UART_HWCONTROL_NONE;
  huart1.Init.OverSampling = UART_OVERSAMPLING_16;
  if (HAL_HalfDuplex_Init(&huart1) != HAL_OK)
  {
    Error_Handler();
  }
  /* USER CODE BEGIN USART1_Init 2 */

  /* USER CODE END USART1_Init 2 */

}

/**
  * @brief USART2 Initialization Function
  * @param None
  * @retval None
  */
static void MX_USART2_UART_Init(void)
{

  /* USER CODE BEGIN USART2_Init 0 */

  /* USER CODE END USART2_Init 0 */

  /* USER CODE BEGIN USART2_Init 1 */

  /* USER CODE END USART2_Init 1 */
  huart2.Instance = USART2;
  huart2.Init.BaudRate = 115200;
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
  /* USER CODE BEGIN USART2_Init 2 */

  /* USER CODE END USART2_Init 2 */

}

/**
  * Enable DMA controller clock
  */
static void MX_DMA_Init(void)
{

  /* DMA controller clock enable */
  __HAL_RCC_DMA2_CLK_ENABLE();

  /* DMA interrupt init */
  /* DMA2_Stream0_IRQn interrupt configuration */
  HAL_NVIC_SetPriority(DMA2_Stream0_IRQn, 0, 0);
  HAL_NVIC_EnableIRQ(DMA2_Stream0_IRQn);
  /* DMA2_Stream2_IRQn interrupt configuration */
  HAL_NVIC_SetPriority(DMA2_Stream2_IRQn, 0, 0);
  HAL_NVIC_EnableIRQ(DMA2_Stream2_IRQn);
  /* DMA2_Stream7_IRQn interrupt configuration */
  HAL_NVIC_SetPriority(DMA2_Stream7_IRQn, 0, 0);
  HAL_NVIC_EnableIRQ(DMA2_Stream7_IRQn);

}

/**
  * @brief GPIO Initialization Function
  * @param None
  * @retval None
  */
static void MX_GPIO_Init(void)
{
  GPIO_InitTypeDef GPIO_InitStruct = {0};
  /* USER CODE BEGIN MX_GPIO_Init_1 */

  /* USER CODE END MX_GPIO_Init_1 */

  /* GPIO Ports Clock Enable */
  __HAL_RCC_GPIOC_CLK_ENABLE();
  __HAL_RCC_GPIOA_CLK_ENABLE();
  __HAL_RCC_GPIOB_CLK_ENABLE();

  /*Configure GPIO pin Output Level */
  HAL_GPIO_WritePin(GPIOA, GPIO_PIN_5, GPIO_PIN_RESET);

  /*Configure GPIO pin : PC13 */
  GPIO_InitStruct.Pin = GPIO_PIN_13;
  GPIO_InitStruct.Mode = GPIO_MODE_IT_FALLING;
  GPIO_InitStruct.Pull = GPIO_NOPULL;
  HAL_GPIO_Init(GPIOC, &GPIO_InitStruct);

  /*Configure GPIO pin : PA5 */
  GPIO_InitStruct.Pin = GPIO_PIN_5;
  GPIO_InitStruct.Mode = GPIO_MODE_OUTPUT_PP;
  GPIO_InitStruct.Pull = GPIO_NOPULL;
  GPIO_InitStruct.Speed = GPIO_SPEED_FREQ_LOW;
  HAL_GPIO_Init(GPIOA, &GPIO_InitStruct);

  /* EXTI interrupt init*/
  HAL_NVIC_SetPriority(EXTI15_10_IRQn, 0, 0);
  HAL_NVIC_EnableIRQ(EXTI15_10_IRQn);

  /* USER CODE BEGIN MX_GPIO_Init_2 */

  /* USER CODE END MX_GPIO_Init_2 */
}

/* USER CODE BEGIN 4 */

/* USER CODE END 4 */

/**
  * @brief  This function is executed in case of error occurrence.
  * @retval None
  */
void Error_Handler(void)
{
  /* USER CODE BEGIN Error_Handler_Debug */
  /* User can add his own implementation to report the HAL error return state */
  __disable_irq();
  while (1)
  {
  }
  /* USER CODE END Error_Handler_Debug */
}
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
