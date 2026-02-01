`timescale 1ns / 1ps
//////////////////////////////////////////////////////////////////////////////////
// Company: 
// Engineer: 
// 
// Create Date: 10.12.2025 16:58:16
// Design Name: 
// Module Name: Oledcontrol
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


module Oledcontrol(
input clock,
input reset,
output oled_spi_clk,
output wire oled_spi_data,
output reg oled_vdd,
output reg oled_vbat,
output reg oled_reset,
output reg oled_dc
);

reg [6:0]state;
reg [6:0]next_state;
reg load_data;
reg start_delay;
wire delay_complete;
reg reset_n;
reg [7:0]data_in;
wire data_transfer_comp;
wire spi_clock;
wire spi_reg;
wire reset_ack;

assign oled_spi_data=spi_reg;
assign oled_spi_clk=spi_clock;

spi_controller spi(
.data_in(data_in),
.reset(reset_n),
.master_clock(clock),
.load_data(load_data),
.spi_clock(spi_clock),
.data_transfer_comp(data_transfer_comp),
.spi_reg(spi_reg),
.reset_ack(reset_ack)
);

delay_time del(
.delay_enable(start_delay),
.clock(clock),
.delay_complete(delay_complete)
);

localparam  IDLE=6'd0,
            DELAY=6'd1,
            INIT_0=6'd2,
            init_reset=6'd3,
            data_transfer_incomp=6'd4,
            data_comp=6'd5,
            remove_reset=6'd6,
            RESET=6'd7,
            charge_pump_0=6'd8,
            charge_pump_1=6'd9,
            precharge_pump_0=6'd10,
            precharge_pump_1=6'd11,
            VBAT_reset=6'd12,
            contrast_0=6'd13,
            contrast_1=6'd14,
            segment_remap=6'd15,
            scan_direction=6'd16,
            com_pin_0=6'd17,
            com_pin_1=6'd18,
            display_on=6'd19,
            DONE=6'd20;
            
            
            
            
            
            
            
           
            


always@(posedge clock)
begin
    if(reset)
    begin
        state<=IDLE;
        next_state<=IDLE;
        oled_reset<=1;
        oled_vdd<=1;
        oled_dc<=1;
        oled_vbat<=1;
        start_delay<=0;
        load_data<=0;
        reset_n<=1;
        data_in<=0;
    end
    else
        begin
            case(state)
            IDLE:begin
            oled_vbat<=1;
            oled_reset<=1;
            reset_n<=0;
            state<=DELAY;
            next_state<=INIT_0;
            end
            
            DELAY:begin
            start_delay<=1;
            if(delay_complete==1)
            begin
            start_delay<=0;
            state<=next_state;
            end
            else state<=DELAY;
            end
            
            INIT_0:begin
            data_in='hAE;
             reset_n<=1;
             load_data<=1;
             state<=init_reset;
             next_state<=remove_reset;
             end
             
             init_reset:begin
                            if(reset_ack==1)
                            begin
                                reset_n<=0;
                                state<=data_transfer_incomp;
                            end
                            else state<=init_reset;    
                        end
             
             
            data_transfer_incomp:begin
                                 if(data_transfer_comp==1)begin
                                        load_data<=0;
                                        state<=data_comp;
                                    end
                                 else state<=data_transfer_incomp;
                                 end
                                  
            data_comp:begin
                        if(data_transfer_comp==0)
                            state<=next_state;
                        else state<=data_comp;
                        end
            remove_reset:begin
                            oled_reset<=0;
                            state<=RESET;
                         end
            
            RESET:begin
            oled_reset<=1;
            state<=DELAY;
            next_state<=charge_pump_0;
            end
            
            charge_pump_0:begin
                        data_in='h8D;            
                        reset_n<=1;
                        load_data<=1;
                        state<=init_reset;
                        next_state<=charge_pump_1;
             end
             
             charge_pump_1:begin
                            data_in='h14;            
                            reset_n<=1;
                            load_data<=1;
                            state<=init_reset;
                            next_state<=precharge_pump_0;
             end
             
             precharge_pump_0:begin
                            data_in='hD9;            
                            reset_n<=1;
                            load_data<=1;
                            state<=init_reset;
                            next_state<=precharge_pump_1;
             end
             
             precharge_pump_1:begin
                            data_in='hF1;            
                            reset_n<=1;
                            load_data<=1;
                            state<=init_reset;
                            next_state<=VBAT_reset;   
             end
             
             VBAT_reset:begin
                        oled_vbat<=0;
                        state<=DELAY;
                        next_state<=contrast_0;
             end
             
              contrast_0:begin
                            data_in='h81;            
                            reset_n<=1;
                            load_data<=1;
                            state<=init_reset;
                            next_state<=contrast_1;
             end
             
             contrast_1:begin
                            data_in='hFF;            
                            reset_n<=1;
                            load_data<=1;
                            state<=init_reset;
                            next_state<=segment_remap;   
             end
            
            segment_remap:begin
                            data_in='hA0;            
                            reset_n<=1;
                            load_data<=1;
                            state<=init_reset;
                            next_state<=scan_direction; 
                            end                  
            
            
            scan_direction:begin
                            data_in='hC0;            
                            reset_n<=1;
                            load_data<=1;
                            state<=init_reset;
                            next_state<=com_pin_0; 
                            end  
            
            com_pin_0:begin
                    data_in='hDA;            
                    reset_n<=1;
                    load_data<=1;
                    state<=init_reset;
                    next_state<=com_pin_1; 
                    end
                    
            com_pin_1:begin
                    data_in='h00;            
                    reset_n<=1;
                    load_data<=1;
                    state<=init_reset;
                    next_state<=display_on; 
                    end                             
              
            
            display_on:begin
            data_in='hAF;            
                    reset_n<=1;
                    load_data<=1;
                    state<=init_reset;
                    next_state<=DONE; 
                    end  
            
            DONE:begin
            state <= DONE;
            end
                       
                default: 
                begin
                    state <= IDLE; 
                end
            endcase
        end  
end

endmodule
