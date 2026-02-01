`timescale 1ns / 1ps
//////////////////////////////////////////////////////////////////////////////////
// Company: 
// Engineer: 
// 
// Create Date: 16.01.2026 01:18:03
// Design Name: 
// Module Name: FFT
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


module FFT(
input clock,
input reset,
output reg ena,
output reg enb,
output reg w_enable_a,
output reg w_enable_b,
output reg[11:0] address_a,
output reg[11:0] address_b,
input [31:0] data_out_a,
input [31:0] data_out_b,
output reg[31:0] dinput_a,
output reg[31:0] dinput_b,
output reg[31:0]X,
output reg input_valid,
output reg  signed [31:0] twiddle_real_out,
output reg  signed [31:0] twiddle_imag_out,
output reg [8:0] twiddle_addr,
output reg twiddle_addr_valid,
input wire complete,
input comp_data_out_a,
input comp_data_out_b,
output reg[8:0]N_point_dft,
output reg low_addr_sig,
output reg high_addr_sig
);



localparam IDLE = 'd0,
           gather_data_twiddle = 'd1,
           gather_data_twiddle_1 ='d2,
           two_point_twiddle = 'd3,
           twiddle_transfer_complete ='d4,
           two_point_input_0 ='d5,
           two_point_input_1 ='d6,
           gather_data_input_0 ='d7,
           waiting_state ='d8,
           release_state ='d9,          
           evaluation='d10,
           send_back= 'd11,
           write_enable='d12,
           DONE='d13,
           read_check='d14,
           final_done='d15;

           
//reg [4:0] state;         
reg [11:0] limit;
reg [8:0] tw_addr;
reg [11:0] offset;
reg data_valid; 
reg [11:0]offset_low;
reg [11:0]offset_high;
reg signed [31:0] real_input_a;
reg signed [31:0] img_input_a;
reg signed [31:0] real_input_b;
reg signed [31:0] img_input_b;
reg two_comp;
reg state_delay;
reg [31:0]evalv_real_a;
reg [31:0]evalv_input_b;
reg [63:0]mult_real_a;
reg [63:0]mult_real_b;
reg [63:0]mult_img_a;
reg [63:0]mult_img_b;
reg [8:0]input_high;
reg [8:0]input_low;
reg[4:0]state;
reg[4:0]prev_state;
reg[8:0]high_address;
reg[8:0]low_address;
reg[3:0]count;
/*reg signed [31:0] real_input;
2-0
4-2
8-6
16-14
32-30
64-62
128-126
256-254
512-510
1024-1022
ends untill 1022
input sampling-2046
*/

/*reg signed [31:0] real_input;
2-0
4-1
8-3
16-7
32-15
64-31
128-63
256-127
512-255
1024-511
ends untill 1022
input sampling-1023 to 1086
*/
  
always@(posedge clock)
begin
    if(reset)
    begin
        //address_a<=0;
        //address_b<=1;
        ena<=0;
        enb<=0;
        w_enable_a<=0;
        w_enable_b<=0;
        X<=0;
        state<=IDLE;
        limit<=1;
        tw_addr<=0;
        offset<=0;
        ena<=0;
        data_valid<=0;
        two_comp<=0;
        real_input_a<=0;
        real_input_b<=0;
        img_input_a<=0;
        img_input_b<=0;
        dinput_a<=0;
        dinput_b<=0;
        twiddle_addr<=0;
        state_delay<=0;
        twiddle_addr_valid<=0;
        twiddle_addr<=0;
        input_valid<=0;
        high_address<=0;
        low_address<=0;
        low_addr_sig<=0;
        high_addr_sig<=0;
        count<=0;
    end
    else
        begin
            case(state)
                IDLE:begin
                    ena<=1;
                    enb<=1;
                    state<=two_point_twiddle;
                end
                
                two_point_twiddle:begin
                    w_enable_a<=0;
                    w_enable_b<=0;
                    address_a<=0;//given offset where W2 0 strarts from 0
                    address_b<=1;//given offset where W2 0 strarts from 1 since imaginary is next to real
                    limit<=1;
                    tw_addr<=0;
                    twiddle_addr_valid<=1;
                    N_point_dft<=1;
                    state<=gather_data_twiddle;
                end
                
                gather_data_twiddle:begin
                    if(tw_addr<limit)
                    begin                
                        twiddle_real_out <= data_out_a;
                        twiddle_imag_out <= data_out_b;
                        state<=gather_data_twiddle_1;                
                    end
                    else
                    begin
                        state<=twiddle_transfer_complete;
                        ena<=0;
                        enb<=0;
                    end
                end
                
                twiddle_transfer_complete:begin
                state<=two_point_input_0;
                twiddle_addr_valid<=0;
                end
                
                gather_data_twiddle_1:begin
                    tw_addr<=tw_addr+1;
                    twiddle_addr<=tw_addr;
                    address_a<=address_a+2;
                    address_b<=address_b+2;
                    state<=gather_data_twiddle;
                end
                
                two_point_input_0:begin
                    ena<=1;
                    enb<=1;
                    w_enable_a<=0;
                    address_a<=2046+low_address;//starting address of real x[0]
                    w_enable_b<=0;
                    address_b<=2047+low_address;//starting address of img x[0]
                    limit<=63;
                    N_point_dft<=0;
                    prev_state<=two_point_input_0;
                    state<=gather_data_input_0;
                end
                
                gather_data_input_0:begin
                    if(prev_state==two_point_input_0)
                    begin
                    state<=two_point_input_1;
                    low_address=low_address+2;
                    end
                    
                    else if(prev_state==two_point_input_1)
                    begin
                    state<=waiting_state;
                    low_addr_sig<=1;
                    high_address<=high_address+2;
                    end
                end 
                
                two_point_input_1:begin
                address_a<=2046+64+high_address;    //starting address of real x[32]
                address_b<=2047+64+high_address;    //starting address of img x[32]
                
                prev_state<=two_point_input_1;
                N_point_dft<=0;
                state<=gather_data_input_0;
                end
                
                waiting_state:begin
                low_addr_sig<=0;
                count<=count+1;
                if(count==1)
                high_addr_sig<=1;
                if(count==2)
                begin
                high_addr_sig<=0;
                state<=release_state;
                count<=0;
                end
                end
                
                release_state:begin
                input_valid<=1;
                if(complete)
                begin
                input_valid<=0;
                if(high_address<limit)
                begin
                state<=two_point_input_0;
                state_delay<=0;
                end
                else
                state<=DONE;
                end
                end
                
                
                 evaluation:begin
                    //img_input_b<=img_input_a+(img_twiddle_buffer[0]*real_input_a+real_twiddle_buffer[0]*img_input_a);
                    //img_input_a<=img_input_a+(-img_twiddle_buffer[0]*real_input_a-real_twiddle_buffer[0]*img_input_a);
                    tw_addr<=tw_addr+1;
                    state<=send_back;
                 end
                 send_back:begin
                    w_enable_a<=1;
                    w_enable_b<=1;
                    state<=write_enable;
                 end
                 write_enable:begin
                 address_a<=address_a+2;
                 address_b<=address_b+2;
                 w_enable_a<=0;
                 w_enable_b<=0;
                 end
                 
                 /*DONE:begin
                 if(tw_addr<limit)
                    begin
                        if(data_valid==1)
                        begin
                            real_input_a<=data_out_a;
                            real_input_b<=data_out_b;
                            if(state_delay==1)
                            begin
                            address_a<=address_a+2;
                            address_b<=address_b+2;
                            state_delay<=0;
                            tw_addr<=tw_addr+1;
                            end
                            state_delay<=1;
                        end
                        data_valid<=1;
                    end
                    else
                    begin
                    state<=final_done;
                    end
                 end*/
            endcase
        end          
end


endmodule
