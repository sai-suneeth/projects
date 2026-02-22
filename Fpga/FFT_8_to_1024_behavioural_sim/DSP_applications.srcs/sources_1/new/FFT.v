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
output reg input_valid,
output reg [31:0] twiddle_real_out,
output reg [31:0] twiddle_imag_out,
output reg [8:0] twiddle_addr,
output reg twiddle_addr_valid,
input wire complete,
output reg[8:0]N_point_dft,
output reg low_addr_sig,
output reg high_addr_sig,
input capture,
output reg complete_ack,
input [31:0] real_input_a,
input [31:0] img_input_a,
input [31:0] real_input_b,
input [31:0] img_input_b,
output reg stage_start
);

integer N=64;
integer i=0;
integer k=0;
parameter begining_input_address=2046;
parameter ending_input_address=2046;



localparam IDLE = 'd0,
           two_point_twiddle = 'd1,
           gather_data_twiddle = 'd3,
           two_point_input_0 ='d4,
           gather_data_input_0 ='d5,
           two_point_input_1 ='d6,
           waiting_state ='d7,
           input_validation= 'd8,
           release_state ='d9,          
           restore_init_low='d10,
           restore_init_high='d11,
           end_comparison='d12,
           DONE='d13,
           nothing_0='d14,
           wasting_state_0='d15,
           stage_0='d16,
           stage_1='d17,
           stage_2='d18,
           stage_3='d19,
           stage_4='d20,
           stage_5='d21,
           stage_6='d22,
           stage_7='d23,
           lazy_0='d24,
           lazy_1='d25;
           
           
           

                
reg [11:0] limit;
reg [11:0] offset;
reg data_valid; 
reg [11:0]offset_low;
reg [11:0]offset_high;
reg [31:0]evalv_real_a;
reg [31:0]evalv_input_b;
reg [63:0]mult_real_a;
reg [63:0]mult_real_b;
reg [63:0]mult_img_a;
reg [63:0]mult_img_b;
reg [8:0]input_high;
reg [8:0]input_low;
reg[5:0]state;
reg[4:0]prev_state;
reg[8:0]high_address;
reg[8:0]low_address;
reg[3:0]count;
reg state_skip;
reg [11:0]input_addr_cap_a_low;
reg [11:0]input_addr_cap_b_low;
reg [11:0]input_addr_cap_a_high;
reg [11:0]input_addr_cap_b_high;

reg [5:0]stage_count;
reg [8:0]stage_limit;
reg [12:0]stage_offset;
reg [8:0]limit_count;
reg [8:0] butterfly_distance;
reg [11:0] butterfly_offset;
reg [4:0] current_stage;
reg [4:0] next_stage;
reg [8:0]twiddle_limit;
reg [8:0] group_base;
reg [8:0] group_limit;

/*
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

control variables N,k N->n point dft we wish to find out and k ->twiddle calculator
offset give the starting point of the twiddle factors.
*/
  
always@(posedge clock)
begin
    if(reset)
    begin
        ena<=0;
        enb<=0;
        w_enable_a<=0;
        w_enable_b<=0;
        state<=IDLE;
        limit<=1;
        offset<=0;
        data_valid<=0;
        dinput_a<=0;
        dinput_b<=0;
        twiddle_addr<=0;
        twiddle_addr_valid<=0;
        twiddle_addr<=0;
        input_valid<=0;
        high_address<=0;
        low_address<=0;
        low_addr_sig<=0;
        high_addr_sig<=0;
        count<=0;
        
        twiddle_real_out<=0;
        twiddle_imag_out<=0;
        complete_ack<=0;
        stage_count<=0;
        stage_limit<=0;
        twiddle_limit<=0;
        stage_offset<=0;
        limit_count<=0;
        stage_start<=0;
    end
    else
        begin
            case(state)
                IDLE:begin
                    ena<=1;
                    enb<=1;
                    state<=stage_0;
                    address_a<=0;
                    address_b<=1;
                end
                
                two_point_twiddle:begin
                    w_enable_a<=0;
                    w_enable_b<=0;
                    address_a<=0+stage_offset;//given offset where W2 0 strarts from 0
                    address_b<=1+stage_offset;//given offset where W2 0 strarts from 1 since imaginary is next to real
                    state<=gather_data_twiddle;
                    limit<=twiddle_limit;
                    count<=0;
                end
                                
                gather_data_twiddle:begin
                                twiddle_addr_valid<=1;
                                if(count==1)
                                begin
                                    twiddle_real_out<=data_out_a;
                                    twiddle_imag_out<=data_out_b;
                                    count<=count+1;
                                end
                                if(count==2)
                                begin
                                    if(limit_count<limit)
                                    begin
                                        address_a<=address_a+2;
                                        address_b<=address_b+2;
                                        twiddle_addr<=twiddle_addr+1;
                                        limit_count<=limit_count+1;
                                    end
                                    else 
                                    begin 
                                        state<=two_point_input_0;
                                        count<=0;
                                        limit_count<=0;
                                        ena<=1;
                                        enb<=1;
                                    end
                                    count<=0;
                                end
                                else
                                    count<=count+1;
                            end
                          
                
                two_point_input_0:begin
                    twiddle_addr_valid<=0;
                    twiddle_addr<=0;
                    ena<=1;
                    enb<=1;
                    w_enable_a<=0;
                    address_a <= begining_input_address+group_base+low_address;//starting address of real x[0]
                    w_enable_b<=0;
                    address_b <= begining_input_address+group_base+low_address+1;//starting address of img x[0]
                    limit<=N-1;
                    prev_state<=two_point_input_0;
                    state<=gather_data_input_0;
                end
                
                
                gather_data_input_0:begin
                    if(prev_state==two_point_input_0)
                    begin
                    state<=two_point_input_1;
                    low_address=low_address+2;
                    input_addr_cap_a_low<=address_a;
                    input_addr_cap_b_low<=address_b;
                    end
                    
                    else if(prev_state==two_point_input_1)
                    begin
                    state<=waiting_state;
                    low_addr_sig<=1;
                    high_address<=high_address+2;
                    input_addr_cap_a_high<=address_a;
                    input_addr_cap_b_high<=address_b;
                    end
                end 
                
                two_point_input_1:begin
                address_a<=begining_input_address+group_base+high_address;    //starting address of real x[32]
                address_b<=begining_input_address+group_base+high_address+1;    //starting address of img x[32]
                prev_state<=two_point_input_1;
                state<=gather_data_input_0;
                end
                
                waiting_state:begin
                if(count<=0)
                    begin
                    low_addr_sig<=0;
                    count<=count+1;
                    end
                else if(count==1)
                begin
                    high_addr_sig<=1;
                    count<=count+1;
                end
                else if(count==2)
                begin
                    high_addr_sig<=0;
                    state<=input_validation;
                    count<=0;
                end
                end
                
                input_validation:begin
                input_valid<=1;
                if(capture)
                begin
                    input_valid<=0;
                    state<=release_state;   
                end
                end
                
                release_state:begin
                if(complete)
                begin
                    complete_ack<=1;
                    w_enable_a<=1;
                    w_enable_b<=1;
                    address_a<=input_addr_cap_a_low;
                    address_b<=input_addr_cap_b_low;
                    dinput_a<=real_input_a;
                    dinput_b<=img_input_a;
                    state<=restore_init_high;
                    count<=0;
                end
                end
                
                restore_init_low:
                begin
                    complete_ack<=0;
                    state<=restore_init_high;             
                end
                
                restore_init_high:
                begin
                complete_ack<=0;
                address_a<=input_addr_cap_a_high;
                address_b<=input_addr_cap_b_high;
                dinput_a<=real_input_b;
                dinput_b<=img_input_b;
                state<=end_comparison;
                end
                
                end_comparison:
                begin
                if(high_address<(N*2-1))
                    begin
                        if(low_address<(group_base + (butterfly_distance)))
                        begin
                            state<=two_point_input_0;
                        end
                        else
                        begin
                            group_base <= group_base + (butterfly_distance);
                            state<=lazy_0;
                        end
                    end
                    else
                        begin
                        state<=DONE;
                        //stage_count <= stage_count + 1;
                        stage_start<=1;
                    end
                end
                
               lazy_0:begin
               state<=two_point_input_0;
               end 
                
                DONE:begin
                w_enable_a<=0;
                w_enable_b<=0;
                address_a<=2046;
                address_b<=2047;
                limit<=2046+128-1;
                state<=nothing_0;
                end
                
                nothing_0:
                begin
                if(count==1)
                begin
                    if(address_a<limit)
                    begin
                    address_a<=address_a+2;
                    address_b<=address_b+2;
                    count<=0;
                    end
                else
                begin
                    state<=wasting_state_0;
                    count<=0;
                end
                end
                else
                count<=count+1;
                end
                
                wasting_state_0:
                begin
                    stage_start <= 0;
                    if(count==2)
                    begin
                        state<=next_stage;
                        count<=0;
                    end
                    else
                    count<=count+1;
                    end
                
                stage_0:
                begin
                    if(count==0)
                    begin
                        stage_count <= 0;   //shows number of stages
                        stage_offset <= 0;
                    
                        N_point_dft <= 1;
                        limit_count <= 0;   
                        twiddle_limit <= 1;  //twiddle limit
                    
                        butterfly_distance <= 64; //add offset from low address to high address
                        count<=count+1;
                    end
                    else if(count==1)
                    begin
                        group_base <= 0;
                        low_address <= 0;
                        high_address <= butterfly_distance;
                        
                        twiddle_addr <= 0;
                        count<=0;
                        state <= two_point_twiddle;
                        current_stage<=stage_0;
                        next_stage<=stage_1;
                    end
                end
                
                stage_1:
                    begin
                        if(count==0)
                        begin
                            stage_count<= 1;
                            stage_offset<= 2;
                            
                            twiddle_limit<= 2;
                            limit_count <= 0;
                            N_point_dft <= 2;
                            
                            butterfly_distance <= 32;
                            count<=count + 1;
                        end
                        else if(count==1)
                        begin
                            group_base <= 0;
                            low_address <= 0;
                            high_address <= butterfly_distance;

                            twiddle_addr <= 0;
                            count<=0;
                            state <= two_point_twiddle;
                            current_stage<=stage_1;
                            next_stage<=stage_2;
                        end
                    end
                    
                    stage_2:
                        begin
                            if(count==0)
                            begin
                                stage_count <= 2;
                                stage_offset <= 6;
                        
                                twiddle_limit <= 4;
                                limit_count   <= 0;
                                N_point_dft   <= 4;
                        
                                butterfly_distance <= 16;  // 8 index × 2 (real+imag)
                                count <= count + 1;
                            end
                            else if(count==1)
                            begin
                                group_base   <= 0;
                                low_address  <= 0;
                                high_address <= butterfly_distance;
                        
                                twiddle_addr <= 0;
                                count <= 0;
                                state <= two_point_twiddle;
                                current_stage <= stage_2;
                                next_stage    <= stage_3;
                            end
                        end
                    
                    stage_3:
                        begin
                            if(count==0)
                            begin
                                stage_count <= 3;
                                stage_offset <= 14;
                        
                                twiddle_limit <= 8;
                                limit_count   <= 0;
                                N_point_dft   <= 8;
                        
                                butterfly_distance <= 8;   // 4 index × 2
                                count <= count + 1;
                            end
                            else if(count==1)
                            begin
                                group_base   <= 0;
                                low_address  <= 0;
                                high_address <= butterfly_distance;
                        
                                twiddle_addr <= 0;
                                count <= 0;
                                state <= two_point_twiddle;
                                current_stage <= stage_3;
                                next_stage    <= stage_4;
                            end
                        end
                        
                        stage_4:
                        begin
                            if(count==0)
                            begin
                                stage_count <= 3;
                                stage_offset <= 14;
                        
                                twiddle_limit <= 8;
                                limit_count   <= 0;
                                N_point_dft   <= 8;
                        
                                butterfly_distance <= 8;   // 4 index × 2
                                count <= count + 1;
                            end
                            else if(count==1)
                            begin
                                group_base   <= 0;
                                low_address  <= 0;
                                high_address <= butterfly_distance;
                        
                                twiddle_addr <= 0;
                                count <= 0;
                                state <= two_point_twiddle;
                                current_stage <= stage_4;
                                next_stage    <= stage_5;
                            end
                        end
                        
                        stage_4:
                        begin
                            if(count==0)
                            begin
                                stage_count <= 4;
                                stage_offset <= 30;
                        
                                twiddle_limit <= 16;
                                limit_count   <= 0;
                                N_point_dft   <= 16;
                        
                                butterfly_distance <= 4;   // 4 index × 2
                                count <= count + 1;
                            end
                            else if(count==1)
                            begin
                                group_base   <= 0;
                                low_address  <= 0;
                                high_address <= butterfly_distance;
                        
                                twiddle_addr <= 0;
                                count <= 0;
                                state <= two_point_twiddle;
                                current_stage <= stage_4;
                                next_stage    <= stage_5;
                            end
                        end
                        
                        stage_5:
                        begin
                            if(count==0)
                            begin
                                stage_count <= 5;
                                stage_offset <= 62;
                        
                                twiddle_limit <= 32;
                                limit_count   <= 0;
                                N_point_dft   <= 32;
                        
                                butterfly_distance <= 2;   // 4 index × 2
                                count <= count + 1;
                            end
                            else if(count==1)
                            begin
                                group_base   <= 0;
                                low_address  <= 0;
                                high_address <= butterfly_distance;
                        
                                twiddle_addr <= 0;
                                count <= 0;
                                state <= two_point_twiddle;
                                current_stage <= stage_5;
                                next_stage    <= stage_6;
                            end
                        end

                    

                
            endcase
        end          
end


endmodule
