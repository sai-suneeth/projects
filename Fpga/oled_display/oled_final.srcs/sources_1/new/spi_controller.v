`timescale 1ns / 1ps
//////////////////////////////////////////////////////////////////////////////////
// Company: 
// Engineer: 
// 
// Create Date: 09.12.2025 18:50:41
// Design Name: 
// Module Name: spi_controller
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


module spi_controller(
input [7:0]data_in,
input reset,
input master_clock,
input load_data,
output reg spi_clock,
output reg data_transfer_comp,
output reg spi_reg,
output reg reset_ack
);

reg [4:0]counter;
reg [2:0] state;
reg [7:0]shift_reg;
reg [4:0]data_count;
reg enable;




localparam IDLE='d0,data_transfer='d1,DONE='d2;


always@(posedge master_clock)
begin
       
        if(counter==9)
        begin
        counter<=0;
        if(enable)
        spi_clock<=~spi_clock;
        end
    else 
        counter<=counter+1;
    end

always@(posedge master_clock)
begin
    if(reset)
    begin
        spi_clock<=1;
        counter<=0;
        data_transfer_comp<=0;
        data_count<=0;
        enable<=0;
        shift_reg<=0;
        spi_reg<=0;
        state<=0;
        reset_ack<=1;
    end
    else begin
            case(state)
            IDLE:begin
                    if(load_data)
                    begin
                        shift_reg<= data_in;
                        state<=data_transfer;
                    end
                    else state<=state;
                end
            
            data_transfer:begin
                        if(counter==4)
                        begin
                        spi_reg <= shift_reg[7];
                        shift_reg <= {shift_reg[6:0],1'b0};
                        enable <= 1;
                        spi_clock<=~spi_clock;
                        if(data_count != 7)
                            data_count <= data_count + 1;
                        else
                        begin
                            state <= DONE;
                        end
                        end
                        end
            DONE:begin
                enable <= 0;
                if(counter==9)
                begin
                spi_clock<=1;
                data_transfer_comp<=1;
                end
                if(!load_data)
                begin
                    data_transfer_comp<=0;
                    state <= IDLE;
                end
            end
                         
                endcase                     
                end           
 
end

endmodule
