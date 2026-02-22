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
input  wire [31:0] data_out_a,   
input  wire [31:0] data_out_b,   
input  wire [31:0] real_twiddle, 
input  wire [31:0] img_twiddle,
output reg complete,
input wire [8:0] twiddle_addr,
input wire twiddle_addr_valid,
input wire [8:0]N_point_dft,
input low_addr_sig,
input high_addr_sig,
output reg capture,
input complete_ack,
output reg [31:0] real_input_a,
output reg [31:0] real_input_b,
output reg [31:0] img_input_a,
output reg [31:0] img_input_b,
input wire stage_start
    );
    
    
localparam IDLE = 'd0,
            init ='d1,
            comp_0 = 'd2,
            comp_1 ='d3,
            comp_2 ='d4,
            comp_3 ='d5,
            comp_4 ='d6,
            DONE = 'd7;
            
localparam signed [31:0] NEG_ONE_Q16 = 32'shFFFF_0000;

reg [3:0]state;    
/* 64-bit intermediates */
reg signed [63:0] mul_wr_xb;
reg signed [63:0] mul_wi_xb;

/* twiddle × xb result (Q16.16) */
reg signed [31:0] t_real;
reg signed [31:0] t_imag;

reg signed [63:0] mul1;
reg signed [63:0] mul2;
reg signed [63:0] mul3;
reg signed [63:0] mul4;
/* xa temporary */
reg signed [31:0] xa_real;
reg signed [31:0] xa_imag;
reg signed [31:0] xb_real;
reg signed [31:0] xb_imag;
reg signed [31:0] cap_xa_real;
reg signed [31:0] cap_xa_imag;
reg signed [31:0] cap_xb_real;
reg signed [31:0] cap_xb_imag;

reg signed [31:0] real_twiddle_buffer[0:511];
reg signed [31:0] img_twiddle_buffer[0:511];
reg [8:0]twiddle_count;

reg [8:0] butterfly_count;
reg [8:0] base_index;
reg sign_flip;
reg [31:0] tw_real;
reg [31:0] tw_imag;




    always@(posedge clock)
    begin
        if(twiddle_addr_valid)
        begin
            real_twiddle_buffer[twiddle_addr]<=data_out_a;
            img_twiddle_buffer[twiddle_addr]<=data_out_b;
            twiddle_count<=N_point_dft;
        end
        if(low_addr_sig)
        begin
        cap_xa_real<=data_out_a;
        cap_xa_imag<=data_out_b;
        end
        if(high_addr_sig)
        begin
        cap_xb_real<=data_out_a;
        cap_xb_imag<=data_out_b;
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
        capture<=0;
        butterfly_count <= 0;
    end
    else if(stage_start)
    begin
        butterfly_count <= 0;
        state <= IDLE;
    end
    else
    begin
        case(state)
            IDLE:begin
            complete<=0;
            if(input_valid)
                begin
                xa_real<=cap_xa_real;
                xb_real<=cap_xb_real;
                xa_imag<=cap_xa_imag;
                xb_imag<=cap_xb_imag;
                if(N_point_dft == 1)
                begin
                    base_index <= 0;
                    sign_flip  <= 0;
                end
                else
                begin
                    base_index <= butterfly_count & (twiddle_count - 1);
                    sign_flip  <= butterfly_count[$clog2(twiddle_count)];
                end
                capture<=1;
                state<=init;               
                end
            end     
            
            
                    init:begin
                    if(sign_flip == 0)
                    begin
                        tw_real <= real_twiddle_buffer[base_index];
                        tw_imag <= img_twiddle_buffer[base_index];
                    end
                    else
                    begin
                        tw_real <= -real_twiddle_buffer[base_index];
                        tw_imag <= -img_twiddle_buffer[base_index];
                    end
                    state <= comp_0;
                    end
                    
                    
                    comp_0:begin
                    /* W × xb */
                    capture<=0;
                    mul1 <= $signed(tw_real)*$signed(xb_real);  // wr * xr
                    mul2 <= $signed(tw_imag)*$signed(xb_imag);  // wi * xi
                    mul3 <= $signed(tw_real)*$signed(xb_imag);  // wr * xi
                    mul4 <= $signed(tw_imag)*$signed(xb_real);  // wi * xr

                    state<=comp_1;
                    end
                    
                    comp_1:begin
                    /* scale back */
                    t_real <= (mul1 - mul2) >>> 16;
                    t_imag <= (mul3 + mul4) >>> 16;
                    state<=comp_2;
                    end
                    
                    comp_2:begin
                    /* xa = xa + t */
                    real_input_a <= xa_real + t_real;
                    img_input_a  <= xa_imag + t_imag;
                    
                    real_input_b <= xa_real - t_real;
                    img_input_b  <= xa_imag - t_imag;
                    state<=DONE;
                    end
                                                            
                    DONE:begin
                    complete<=1;
                    if(complete_ack==1)
                    begin
                    complete<=0;
                    butterfly_count <= butterfly_count + 1;
                    state<=IDLE;
                    end
                    end
        endcase    
    end    
    end
    

endmodule
