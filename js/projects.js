
//Check for mobile devices
if( /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ) {
}
else {

//Hide the menu when the user has scrolled past a certain trigger point

	var isOn = false;

	$(window).on('scroll', function() {
		var y_scroll_pos = window.pageYOffset;
		var scroll_pos_test = 20;   
		if(y_scroll_pos > scroll_pos_test && isOn==false) {

			$('#nav').hide(200);
			isOn = true;

		}

		if(y_scroll_pos < scroll_pos_test && isOn==true) {
			$('#nav').show(200);
			isOn = false;
		}
	});

}