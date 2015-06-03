# README #

Provides the ability to control the PLINK Compatible  Projectors.

PJLink Specifications: Version 1.04 2013.12.10

A list Compatible Projectors (but not exclusive, check projector for support):
	http://pjlink.jbmia.or.jp/english/list.html

Each project MUST be configured appropriately to accept PJLink commands.
Currently the ONLY tested mode is with Authentication turned ON.
Password MUST be set on projector prior to configuration of this device.

TESTED ON ## Christie Projector MODEL LWU421 ##

## Usage ##

Command List:
	Power, Input, Lamp, Mute, ErrorStatus, Custom

Since at this time I was unable to filter the Sub-commands based upon the selected command, you will manually need to ensure the appropriate sub-command is selected.

Replies (messages) are in JSON format:  { response: { result: 'value' } }


SubCommands Per-Command:

	Power:  
		- On	Turns On Projector
		- Off	Turns Off Projector
		- Get	Gets current state of Projector
	Reply will be:
		- Success
		- Out-of-Parameter
		- Unavailable
		- Projector Failure
		- Standby
		- On
		- Cooling
		- Warmup

	Input:
		- RGB
		- VIDEO
		- DIGITAL
		- STORAGE
		- NETWORK
		- Get
	Reply will be:
		- Success
		- Invalid Input Source
		- Unavailable
		- Display Failure

	Lamp:
		- Get
	Reply will be:
		- Unavailable
		- Projector Failure
		- Raw Data from Projector in form of:
		  %1LAMP=<T><SP><0 | 1><SP><T><SP><0 | 1>...
		  where:
		     T = Lighting Time of Lamp it is 1 to 5 digits
			 SP = Space
			 <0 | 1> where 0 = OFF 1 = ON
			 ... repeats for each lamp 1 to 8times.
	Mute:
		- VideoON
		- VideoOFF
		- AudioON
		- AudioOFF
		- VideoAndAudioON
		- VideoAndAudioOFF
	Reply will be:
		- Success
		- Out-of-Parameter
		- Unavailable
		- Projector Failure
		- Video Mute ON
		- Audio Mute ON
		- Video and Audio Mute ON
		- Video and Audio Mute OFF

	ErrorStatus:
		- Get
	Reply will be:
		- Normal
		- Unavailable
		- Projector Failure
		- Fan: Warning | Failure
		- Lamp: Warning | Failure
		- Temperature: Warning | Failure
		- Cover: Warning | Failure
		- Airflow: Warning | Failure
		- Temporary: Warning | Failure

		Note:  Fan, Lamp, Temperature, Cover, Airflow  and Temporary will be concatenated together when available such as:
			Fan: Warning, Cover: Failure,

	Custom:
		This will send the 'custom' string AS IS to the Projector and return it's response AS IS.  note: USE AT YOUR OWN RISK 
