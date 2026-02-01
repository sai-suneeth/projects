`timescale 1ns / 1ps
//////////////////////////////////////////////////////////////////////////////////
// Company: 
// Engineer: 
// 
// Create Date: 17.01.2026 23:55:04
// Design Name: 
// Module Name: tb
// Project Name: 
// Target Devices: 
// Tool Versions: 
// Description: 
// 
// Dependencies: 
// 
// Revision:
// Revision 0.01 - File Created
// Additional Comments:
// 
//////////////////////////////////////////////////////////////////////////////////


module tb_top;

    // -----------------------
    // Clock & reset
    // -----------------------
    reg clk;
    reg reset;

    // -----------------------
    // Signals between DUT and BRAM
    // -----------------------
    wire ena;
    wire enb;
    wire wea;
    wire web;
    wire [11:0] addra;
    wire [11:0] addrb;
    wire [31:0] douta;
    wire [31:0] doutb;
    wire [31:0] dina;
    wire [31:0] dinb;
    // Example 64-bit buffer from your IP
    wire [31:0] X;
    wire input_valid;
    wire [31:0]real_twiddle;
    wire [31:0]img_twiddle;
    wire [8:0]twiddle_addr;
    wire twiddle_addr_valid;
    wire complete;
    wire [31:0]comp_data_out_a;
    wire [31:0]comp_data_out_b;
    wire low_addr_sig;
    wire high_addr_sig;
    wire [8:0]N_point_dft;

    // -----------------------
    // Clock generation (100 MHz)
    // -----------------------
    always #5 clk = ~clk;

    initial begin
        clk   = 0;
        reset = 1;
        #20;
        reset = 0;
    end

    // -----------------------
    // DUT (your RTL, NOT packaged IP)
    // -----------------------
    FFT dut (
        .clock(clk),
        .reset(reset),
        .ena(ena),
        .enb(enb),
        .w_enable_a(wea),
        .w_enable_b(web), 
        .address_a(addra),
        .address_b(addrb),
        .data_out_a(douta),
        .data_out_b(doutb),
        .dinput_a(dina),
        .dinput_b(dinb),
        .X(X),
        .input_valid(input_valid),
        .twiddle_real_out(real_twiddle),
        .twiddle_imag_out(img_twiddle),
        .twiddle_addr(twiddle_addr),
        .twiddle_addr_valid(twiddle_addr_valid),
        .complete(complete),
        .comp_data_out_a(comp_data_out_a),
        .comp_data_out_b(comp_data_out_b),
        .N_point_dft(N_point_dft),
        .low_addr_sig(low_addr_sig),
        .high_addr_sig(high_addr_sig)
    );

    // -----------------------
    // Block Memory Generator ROM
    // -----------------------
    blk_mem_gen_0 rom (
        .clka(clk),
        .ena(ena),
        .wea(wea), 
        .addra(addra),
        .dina(dina),
        .douta(douta),
        .clkb(clk),
        .enb(enb),
        .web(web),
        .addrb(addrb),
        .dinb(dinb),
        .doutb(doutb)
    );
    
    computation_modulae u_comp(
                    .clock(clk),
                    .reset(reset),
                    .input_valid(input_valid),
                    .data_out_a(douta),   
                    .data_out_b(doutb),   
                    .real_twiddle(real_twiddle), 
                    .img_twiddle(img_twiddle),
                    .complete(complete),
                    .twiddle_addr(twiddle_addr),
                    .twiddle_addr_valid(twiddle_addr_valid),
                    .comp_data_out_a(comp_data_out_a),
                    .comp_data_out_b(comp_data_out_b),
                    .N_point_dft(N_point_dft),
                    .low_addr_sig(low_addr_sig),
                    .high_addr_sig(high_addr_sig)   
    );

    // -----------------------
    // Simulation control
    // -----------------------
    initial begin
        // run long enough to read several ROM locations
        #2500;
        $finish;
    end

endmodule

