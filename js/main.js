$(document).ready(function() {
  //initial
  $("#nav").delay(500).animate({
    "opacity" : "1",
    "top" : "+=20px"
  }, {easing:"swing"});
  $("#content").load("home.html");
  $("#content").delay(800).animate({
    "opacity" : "1",
    "top" : "+=10px"
  }, {easing:"swing"});
});


