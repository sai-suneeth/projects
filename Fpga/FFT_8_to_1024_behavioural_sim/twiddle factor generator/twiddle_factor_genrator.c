#include <stdio.h>
#include <math.h>
#include <stdint.h>
#define PI 3.14159265358979323846

void write_twiddles(FILE *f, int N)
{
    const int32_t TW_SCALE = 1 << 16;   // Q16.16

    for (int k = 0; k < N / 2; k++)
    {
        double angle = 2.0 * PI * k / N;

        int32_t real = (int32_t)llround(cos(angle) * TW_SCALE);
        int32_t imag = (int32_t)llround(-sin(angle) * TW_SCALE);

        // Saturate to Q16.16 range
        if (real >  0x7FFFFFFF) real =  0x7FFFFFFF;
        if (real < (int32_t)0x80000000) real = (int32_t)0x80000000;
        if (imag >  0x7FFFFFFF) imag =  0x7FFFFFFF;
        if (imag < (int32_t)0x80000000) imag = (int32_t)0x80000000;

        fprintf(f, "%08X,\n", (uint32_t)real);
        fprintf(f, "%08X,\n", (uint32_t)imag);
    }
}

void write_input_data(FILE *f)
{
    const int N = 64;
    const int32_t IN_SCALE = 1 << 16;   // Q16.16

    for (int n = 0; n < N; n++)
    {
        double angle = 2.0 * PI * n / N;

        int32_t real = (int32_t)llround(3.0 * sin(angle) * IN_SCALE);
        int32_t imag = 0;

        if (real >  0x7FFFFFFF) real =  0x7FFFFFFF;
        if (real < (int32_t)0x80000000) real = (int32_t)0x80000000;

        fprintf(f, "%08X,\n", (uint32_t)real);
        fprintf(f, "%08X,\n", (uint32_t)imag);
    }
}



int main(void)
{
    FILE *f = fopen("fft_twiddles.coe", "w");
    if (!f) {
        perror("File open failed");
        return 1;
    }

    fprintf(f, "memory_initialization_radix=16;\n");
    fprintf(f, "memory_initialization_vector=\n");

    // Generate twiddles for all FFT stages
    write_twiddles(f, 2);
    write_twiddles(f, 4);
    write_twiddles(f, 8);
    write_twiddles(f, 16);
    write_twiddles(f, 32);
    write_twiddles(f, 64);
    write_twiddles(f, 128);
    write_twiddles(f, 256);
    write_twiddles(f, 512);
    write_twiddles(f, 1024);
    //fprintf(f, "1024");
    write_input_data(f);
    fprintf(f, ";\n");
    fclose(f);

    printf("fft_twiddles.coe generated (Q1.12, 13-bit data)\n");
    return 0;
}
