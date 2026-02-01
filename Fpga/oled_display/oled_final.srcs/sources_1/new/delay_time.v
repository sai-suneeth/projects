`timescale 1ns / 1ps
//////////////////////////////////////////////////////////////////////////////////
// Company: 
// Engineer: 
// 
// Create Date: 10.12.2025 20:48:20
// Design Name: 
// Module Name: delay_time
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


module delay_time(
input delay_enable,
input clock,
output reg delay_complete
);
reg [17:0]counter;

always@(posedge clock)
begin
if(delay_enable&counter!=200000)
counter<=counter+1;
else
counter<=0;
end

always@(posedge clock)
begin
if(delay_enable&counter==200000)
delay_complete<=1;
else
delay_complete<=0;
end
endmodule
