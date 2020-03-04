# ModulateDemodulate
ModulateDemodulate is a program that was made to display modulating and demodulating of
string data within a computer network. The program is meant to show the graphical representation
of voltages depending on its encoding scheme. This program will accept inputs from the user in
forms of character data. The character String will then be converted to ASCII code. Finally,
the ASCII code will be modulated to the schemes listed below and will also be plotted.

Alternatively, you can also decode voltage arrays back into ASCII code, then again back to 
character Strings once more. Basically, demodulating what you modulated...

### Encoding Schemes
![Encoding Schemes](https://base.imgix.net/files/base/ebm/electronicdesign/image/2017/02/electronicdesign_com_sites_electronicdesign.com_files_uploads_2017_01_13_WtD_NRZ_RZ_and_Manchester_Fig_1.png?auto=format&fit=max&w=1440)
#### NRZI
The NRZI encoding scheme uses a voltage change in between a clock cycle to determine
a 1 and 0 between data. For instance, within one clock pulse, the voltage may change to 2 from a
5, this would indicate a 1 as the voltage changed. If the voltage stayed at what it was the last
clock cycle, then this is a 0.
#### Manchester
The Manchester encoding works similar to the NRZI encoding in regards to having transitions in the 
middle of a clock cycle, but the Manchester encoding provides at least one transition per bit. NRZI
only uses a transition in the middle of the clock cycle when there is a 1 value. The Manchester
encoding makes clock recovery easier.
#### NRZ
Now, technically there are two encoding for NRZ. That being NRZ unipolar and NRZ bipolar. We will
be focusing on the former of the two, NRZ unipolar in which changes voltages at the start of a 
clock cycle to indicate a 1 or 0. A 1 is indicated with a high voltage, whilst a 0 is indicated by
a low voltage.