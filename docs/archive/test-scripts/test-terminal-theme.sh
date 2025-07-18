#!/bin/bash
# Test script for terminal theme switching

echo "Terminal Theme Test Script"
echo "=========================="
echo ""

# ANSI Color Test
echo -e "\033[0mNormal Text"
echo -e "\033[1mBold Text\033[0m"
echo ""

echo "Standard Colors:"
echo -e "\033[30mBlack\033[0m \033[31mRed\033[0m \033[32mGreen\033[0m \033[33mYellow\033[0m"
echo -e "\033[34mBlue\033[0m \033[35mMagenta\033[0m \033[36mCyan\033[0m \033[37mWhite\033[0m"
echo ""

echo "Bright Colors:"
echo -e "\033[90mBright Black\033[0m \033[91mBright Red\033[0m \033[92mBright Green\033[0m \033[93mBright Yellow\033[0m"
echo -e "\033[94mBright Blue\033[0m \033[95mBright Magenta\033[0m \033[96mBright Cyan\033[0m \033[97mBright White\033[0m"
echo ""

echo "Background Colors:"
echo -e "\033[40m Black BG \033[0m \033[41m Red BG \033[0m \033[42m Green BG \033[0m \033[43m Yellow BG \033[0m"
echo -e "\033[44m Blue BG \033[0m \033[45m Magenta BG \033[0m \033[46m Cyan BG \033[0m \033[47m White BG \033[0m"
echo ""

echo "Theme Test Complete!"
echo ""
echo "Instructions:"
echo "1. Run this script in a terminal"
echo "2. Switch between Light/Dark mode in Settings"
echo "3. Colors should adapt to the selected theme"
