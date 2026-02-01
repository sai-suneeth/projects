PROJECT OVERVIEW

This project implements a classic Snake Game entirely using digital logic components without using any microcontroller, FPGA, Arduino, or processor. The complete design is simulated in Proteus and demonstrates hardware-level implementation of movement control, memory management, clock synchronization, and interrupt-driven finite state machine behavior.

The snake moves on an 8×8 LED matrix and is controlled using four push buttons (UP, DOWN, LEFT, RIGHT). Accurate head and tail synchronization is achieved through a custom register-based memory system that stores direction changes and coordinates.

KEY FEATURES

Fully hardware-based Snake Game (no software, no MCU)
Push-button controlled directional movement
Dual-clock architecture with clock gating
Custom interrupt system implemented using logic and 555 timers
Register-based memory for direction and coordinate history
Accurate tail-following using stored head turn data
Individual LED control using 64 D flip-flops
Deterministic and glitch-free synchronous operation


HARDWARE ARCHITECTURE

Direction Control
Four push buttons (UP, DOWN, LEFT, RIGHT) are used for movement control.
A priority encoder ensures that only one direction is accepted at a time and prevents multiple simultaneous inputs.

Direction reversal (180-degree turns) is prevented using combinational logic that blocks opposite-direction inputs.

2.Position Tracking
Two independent up/down counters are used:

One counter for X-axis (left/right movement)

One counter for Y-axis (up/down movement)

The counters generate the current head coordinates, which are decoded to select the active LED.

3.LED Matrix Control
An 8×8 LED matrix is driven using 64 D flip-flops, one per LED.
Each flip-flop latches the ON/OFF state of its corresponding LED.

Head movement sets LEDs ON

Tail movement clears LEDs OFF
This creates the visible snake body of fixed length.

4.Memory System (Direction and Coordinate Storage)
A custom hardware memory system is implemented using 8 sets of registers (total 64 D flip-flops).

Each memory entry stores:

Head X coordinate

Head Y coordinate

Direction code at which the head turned

This memory behaves like a FIFO queue:

Data is written when the head changes direction

Data is retained until the tail consumes it

Entries are used sequentially by the tail

5.Clock Architecture
Two clocks are used:

Main clock (~1 kHz): drives head and tail counters

Side clock (~4 Hz): controls visible movement pacing

Clock gating is used to halt movement during interrupt handling.

WORKING (CURRENT IMPLEMENTATION)

Normal Movement State
During normal operation, the snake head moves continuously based on the active direction.
The main clock drives the X/Y counters, and the decoded output sets the corresponding LED ON.

Direction Change Detection
When a push button is pressed, a direction change is detected.
This triggers a custom hardware interrupt.

Interrupt Handling (Clock Gating)
On interrupt:

The side movement clock is immediately disabled using clock gating logic driven by a 555 timer.

Head and tail motion are temporarily halted.
This prevents partial updates and ensures atomic state changes.

Memory Write Operation
While movement is halted:

The current head coordinates are captured.

The new direction code is captured.

Both values are written into the next available register slot in the memory system.

Previously stored values are not erased and remain valid until the tail uses them.

Tail Following Using Stored Memory
The tail has its own X/Y counters and moves independently.

Comparators continuously check whether the tail has reached a stored head-turn coordinate.
When a match occurs:

The tail updates its direction using the stored direction code.

The memory pointer advances to the next stored entry.

This ensures the tail follows the exact path taken by the head, including all turns.

Resume Execution
After the memory write operation is complete:

The interrupt is released.

The side clock is re-enabled.

Head and tail movement resume synchronously.

This creates deterministic, glitch-free operation similar to a processor interrupt service routine.

LED Body Formation

Head movement clocks LEDs ON.

Tail movement clocks LEDs OFF.
This maintains a fixed-length snake body without any software counters.

Egg Generation
Egg generation logic is not implemented in the current version and has been intentionally excluded from gameplay.






X---------------------------------------------------------------------------------------------------------------------------------------------------X

Directions:

1.click on the reset button first and start with any direction other than left......



