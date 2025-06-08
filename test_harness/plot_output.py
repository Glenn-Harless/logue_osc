#!/usr/bin/env python3
"""
Simple script to visualize oscillator output
"""

import sys
import matplotlib.pyplot as plt
import numpy as np

# Read data from stdin or file
data = []
for line in sys.stdin:
    if line.startswith('#'):
        continue
    try:
        parts = line.strip().split(',')
        if len(parts) == 2:
            sample_num = int(parts[0])
            value = float(parts[1])
            data.append((sample_num, value))
    except:
        pass

if data:
    samples = [d[0] for d in data]
    values = [d[1] for d in data]
    
    plt.figure(figsize=(12, 6))
    plt.plot(samples, values, 'b-', linewidth=0.5)
    plt.xlabel('Sample Number')
    plt.ylabel('Amplitude')
    plt.title('FM Bell Oscillator Output')
    plt.grid(True, alpha=0.3)
    plt.ylim(-1.1, 1.1)
    plt.tight_layout()
    plt.savefig('fm_output.png')
    print(f"Plot saved to fm_output.png")
    print(f"Max amplitude: {max(values):.3f}")
    print(f"Min amplitude: {min(values):.3f}")
else:
    print("No data to plot")