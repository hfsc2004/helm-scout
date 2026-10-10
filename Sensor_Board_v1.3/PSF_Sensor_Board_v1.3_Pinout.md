PSF Sensor Board Rev 1.3
ESP32-S3-CAM GPIO / peripheral map

POWER
- ESP32 module 5V pin: +5V system rail
- ESP32 module GND: common GND
- Board 3.3V rail: AP2112K-3.3 regulator
- USB-C connector is POWER ONLY
- USB-C and external/Uno 5V are selected through TPS2116 power mux

SHARED I2C BUS
- GPIO1 = SCL
- GPIO2 = SDA

I2C devices:
- VL53L5CX 8x8 ToF
- VL53L1CB ToF 0°
- VL53L1CB ToF 180°
- ICM-42607-C IMU
- TCA9534 GPIO expander

TCA9534 GPIO EXPANDER
- P0 = VL53L1CB ToF 0° XSHUT
- P1 = VL53L1CB ToF 180° XSHUT
- P2 = VL53L5CX LPn
- P3 = VL53L5CX I2C_RST
- P6/P7 = AUX I/O connector
- Remaining expander pins should be treated as board-control signals and verified before reuse

PDM MICROPHONES
- Two MSM261DHP006 microphones installed
- Left and Right microphones share PDM timing/data arrangement
- GPIO assignments should be taken from the Rev 1.3 schematic, not the older Rev A GPIO notes

I2S SPEAKER / MAX98357A
- GPIO47 = I2S DIN
- GPIO41 = I2S BCLK
- GPIO42 = I2S LRCLK / WS
- MAX98357A VDD = +5V
- Speaker output is differential:
  SPKR_P / SPKR_N
- Neither speaker terminal is GND

RGBW LEDs
- 3x SKC6812RGBW-BW daisy chained
- GPIO48 = RGBW serial data
- GPIO48 feeds 74HCT125 level buffer before LED chain
- LED1 DOUT -> LED2 DIN -> LED3 DIN
- LEDs powered from +5V

IR LEDs
- 3x 940nm IR emitters
- Driven through AO3400A MOSFET
- Board switch selects control source:
  positions 1-2 = GPIO expander control, default
  positions 2-3 = GPIO4 strobe
- WARNING: GPIO4 conflicts with camera operation; camera must be off when using GPIO4 strobe mode

UART / Arduino interface
- GPIO43 = UART TX
- GPIO44 = UART RX
- External header provides 5V / GND / RX / TX

ESP32-CAM CAMERA
- Camera uses the module's native camera GPIO assignments
- Do not repurpose camera-reserved GPIOs
