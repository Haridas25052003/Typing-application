package com.demo.controller;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.demo.model.TypingResult;

@RestController
@CrossOrigin("*")
public class TypingController {
	
	@GetMapping("/text")
	public String getTypingText() {
		return "practice makes man perfect";
	}
	
	@PostMapping("/result")
	public String saveResult(@RequestBody TypingResult result) {
		
		System.out.println("WPM: "+result.getWpm());
		System.out.println("Accuracy: "+result.getAccuracy());
		System.out.println("Errors: "+result.getErrors());
		
		return "Result received successfully";
	}

}
