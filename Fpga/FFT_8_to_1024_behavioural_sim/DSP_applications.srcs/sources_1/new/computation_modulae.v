`timescale 1ns / 1ps
//////////////////////////////////////////////////////////////////////////////////
// Company: 
// Engineer: 
// 
// Create Date: 24.01.2026 01:59:01
// Design Name: 
// Module Name: computation_modulae
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


module computation_modulae(
input  wire clock,
input  wire reset,
input  wire input_valid,
input  wire signed [31:0] data_out_a,   
input  wire signed [31:0] data_out_b,   
input  wire signed [31:0] real_twiddle, 
input  wire signed [31:0] img_twiddle,
output reg complete,
input wire [8:0] twiddle_addr,
input wire twiddle_addr_valid,
output reg[31:0]comp_data_out_a,
output reg[31:0]comp_data_out_b,
input [8:0]N_point_dft,
input low_addr_sig,
input high_addr_sig
    );
    
    
localparam IDLE = 'd0,
            comp_0 = 'd1,
            comp_1 ='d2,
            comp_2 ='d3,
            comp_3 ='d4,
            comp_4 ='d5,
            DONE = 'd6;
            
localparam signed [31:0] NEG_ONE_Q16 = 32'shFFFF_0000;

reg [3:0]state;    
/* 64-bit intermediates */
reg signed [63:0] mul_wr_xb;
reg signed [63:0] mul_wi_xb;
reg signed [63:0] mul_neg_t_real;
reg signed [63:0] mul_neg_t_imag;
reg signed [31:0] neg_t_real;
reg signed [31:0] neg_t_imag;

/* twiddle × xb result (Q16.16) */
reg signed [31:0] t_real;
reg signed [31:0] t_imag;

/* xa temporary */
reg signed [31:0] xa_real;
reg signed [31:0] xa_imag;
reg signed [31:0] xb_real;
reg signed [31:0] xb_imag;

reg signed [31:0] real_twiddle_buffer[0:511];
reg signed [31:0] img_twiddle_buffer[0:511];
reg [8:0]twiddle_count;

reg[31:0]real_input_a;
reg[31:0]real_input_b;
reg[31:0]img_input_a;
reg[31:0]img_input_b;

    always@(posedge clock)
    begin
        if(twiddle_addr_valid)
        begin
            real_twiddle_buffer[twiddle_addr]<=real_twiddle;
            img_twiddle_buffer[twiddle_addr]<=img_twiddle;
            twiddle_count<=N_point_dft;
        end
        if(low_addr_sig)
        begin
        xa_real<=data_out_a;
        xa_imag<=data_out_b;
        end
        if(high_addr_sig)
        begin
        xb_real<=data_out_a;
        xb_imag<=data_out_b;
        end
    end

always@(posedge clock)
begin
    if(reset)
    begin
        state<=IDLE;
        complete<=0;
        real_input_a<= 0;
        img_input_a<=0;
        real_input_b<= 0;
        img_input_b<= 0;
        state<=IDLE;
    end
    else
    begin
        case(state)
            IDLE:begin
            complete<=0;
            if(input_valid)
                begin
                state<=comp_0;               
                end
            end
                    comp_0:begin
                    /* W × xb */
                    mul_wr_xb<= real_twiddle[N_point_dft]*xb_real; // Q32.32
                    mul_wi_xb<= img_twiddle[N_point_dft]*xb_imag; // Q32.32
                    state<=comp_1;
                    end
                    
                    comp_1:begin
                    /* scale back */
                    t_real <= mul_wr_xb >>> 16;
                    t_imag <= mul_wi_xb >>> 16;
                    state<=comp_2;
                    end
                    
                    comp_2:begin
                    /* ---------- EXPLICIT -1.0 MULTIPLY ---------- */
                    /* -t = (0xFFFF0000 × t) */
                    mul_neg_t_real <= 64'shFFFF0000 * t_real; // -1.0 × t_real
                    mul_neg_t_imag <= 64'shFFFF0000 * t_imag;
                     
                    /* xa = xa + t */
                    real_input_a <= xa_real + t_real;
                    img_input_a  <= xa_imag + t_imag;
                    state<=comp_3;
                    end
                    
                    comp_3:begin
                    /* scale back */
                    neg_t_real <= mul_neg_t_real >>> 16;
                    neg_t_imag <= mul_neg_t_imag >>> 16;
                    state<=comp_4;                   
                    end
                    
                    comp_4:begin
                    /* xb = xa + (-t) */
                    real_input_b <= xa_real + neg_t_real;
                    img_input_b  <= xa_imag + neg_t_imag;
                    state<=DONE;
                    end
                    
                    DONE:begin
                    complete<=1;
                    if(input_valid==0)
                    begin
                    real_input_a<= 0;
                    img_input_a<=0;
                    real_input_b<= 0;
                    img_input_b<= 0;
                    complete<=0;
                    state<=IDLE;
                    end
                    end
        endcase    
    end    
    end
    

endmodule
