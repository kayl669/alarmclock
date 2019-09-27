#! /usr/bin/env python3

import asyncio
import tornado.web
import tornado.websocket
import tornado.httpserver
import tornado.ioloop
import tornado.gen
import threading
import time
import os
from RPi import GPIO
from tornado.platform.asyncio import AnyThreadEventLoopPolicy

class WebSocketHandler(tornado.websocket.WebSocketHandler):
	waiters = set()

	def open(self):
		self.set_nodelay(True)
		print('Socket Connected: ' + str(self.request.remote_ip))
		WebSocketHandler.waiters.add(self)
		WebSocketHandler.send_updates("Hello")

	def on_close(self):
		WebSocketHandler.waiters.remove(self)

	def check_origin(self, origin):
		return True

	@classmethod
	def send_updates(cls, msg):
		print(msg)
		for waiter in cls.waiters:
			try:
				waiter.write_message(msg)
			except Exception as e:
				print(e)
				print("Error sending message")

class WebServer(threading.Thread):
	def run(self):
		asyncio.set_event_loop_policy(AnyThreadEventLoopPolicy())
		application = tornado.web.Application([(r"/websocket", WebSocketHandler)])
		http_server = tornado.httpserver.HTTPServer(application)
		http_server.listen(6123)
		tornado.ioloop.IOLoop.instance().start()


def UpCallback(channel):
        print("Button Pressed Up")
        WebSocketHandler.send_updates("UP")

def LightCallback(channel):
        print("Button Pressed Light")
        res = int(os.popen("sudo sh -c 'cat /sys/class/backlight/soc\:backlight/brightness'").read())
        if (res == 1):
            os.system("sudo sh -c 'echo \"0\" > /sys/class/backlight/soc\:backlight/brightness'")
        else:
            os.system("sudo sh -c 'echo \"1\" > /sys/class/backlight/soc\:backlight/brightness'")

def LeftCallback(channel):
        print("Button Pressed Left")
        WebSocketHandler.send_updates("LEFT")

def OKCallback(channel):
        print("Button Pressed OK")
        WebSocketHandler.send_updates("OK")

def RightCallback(channel):
        print("Button Pressed Right")
        WebSocketHandler.send_updates("RIGHT")

def DownCallback(channel):
        print("Button Pressed Down")
        WebSocketHandler.send_updates("DOWN")

def StopCallback(channel):
        print("Button Pressed Stop")
        WebSocketHandler.send_updates("STOP")

def SnoozeCallback(channel):
        print("Button Pressed Snooze")
        WebSocketHandler.send_updates("SNOOZE")


if __name__ == "__main__":
       GPIO.setmode(GPIO.BCM)
       GPIO.setup(0, GPIO.IN, pull_up_down=GPIO.PUD_UP)  # Right
       GPIO.setup(5, GPIO.IN, pull_up_down=GPIO.PUD_UP)  # Down
       GPIO.setup(6, GPIO.IN, pull_up_down=GPIO.PUD_UP)  # Up
       GPIO.setup(13, GPIO.IN, pull_up_down=GPIO.PUD_UP)  # Light
       GPIO.setup(26, GPIO.IN, pull_up_down=GPIO.PUD_UP)  # Snooze
       GPIO.setup(1, GPIO.IN, pull_up_down=GPIO.PUD_UP)  # Stop
       GPIO.setup(12, GPIO.IN, pull_up_down=GPIO.PUD_UP)  # Left
       GPIO.setup(16, GPIO.IN, pull_up_down=GPIO.PUD_UP)  # OK

       GPIO.add_event_detect(0, GPIO.FALLING, callback=RightCallback, bouncetime=300)
       GPIO.add_event_detect(5, GPIO.FALLING, callback=DownCallback, bouncetime=300)
       GPIO.add_event_detect(6, GPIO.FALLING, callback=UpCallback, bouncetime=300)
       GPIO.add_event_detect(13, GPIO.FALLING, callback=LightCallback, bouncetime=300)
       GPIO.add_event_detect(26, GPIO.FALLING, callback=SnoozeCallback, bouncetime=300)
       GPIO.add_event_detect(1, GPIO.FALLING, callback=StopCallback, bouncetime=300)
       GPIO.add_event_detect(12, GPIO.FALLING, callback=LeftCallback, bouncetime=300)
       GPIO.add_event_detect(16, GPIO.FALLING, callback=OKCallback, bouncetime=300)

       WebServer().start()

