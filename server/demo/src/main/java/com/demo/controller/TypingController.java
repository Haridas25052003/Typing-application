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
		return "Eating good food is important for a strong body. You should eat many fruits and vegetables every day because they give you energy. It is also good to drink plenty of water to stay healthy. Exercise, like walking or playing outside, helps your heart and muscles. If you take care of your body, you will feel happy and active.";
	}
	
	@PostMapping("/result")
	public String saveResult(@RequestBody TypingResult result) {
		System.out.println("POST HIT");
		System.out.println("WPM: "+result.getWpm());
		System.out.println("Accuracy: "+result.getAccuracy());
		System.out.println("Errors: "+result.getErrors());
		
		return "Result received successfully";
	}

}
