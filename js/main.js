
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

  //handle menu clicks
  $("ul#nav li a").click(function(){ //if a button in the navbar is clicked
    var page = $(this).attr("href"); //take the href value (ie. about)
    //For the projects page remove the container constraints
    
    $("#content").hide().load(page + ".html").fadeIn(400);//find the file about.html and load it into content
    
    //transfer the active class over to the tab we are currently on
    $("#nav li").removeClass("active");
    $(this).parent().addClass("active");
    //stop the default of trying to load the href link
    return false;
  })


  //Two methods of handling portfolio links

  //Clicking anywhere on the original image. This was implemented for mobile.
  $(document).on('click', "a.splash-image", function() {
    var page = $(this).attr("href"); //take the id value (ie. about)
    //Animate the navbar leaving
    $("#nav").animate({
      "opacity" : "1",
      "top" : "-=100px"
    }, {duration:1000}, {easing:"swing"});
    $("#content").hide().load(page + ".html").fadeIn(400);//find the file about.html and load it into content

    //stop the default of trying to load the href link
    return false;
  })

  //Clicking on the more info button.
  $(document).on('click', "a.info", function() {
    var page = $(this).attr("href"); //take the href value (ie. about)
    //Animate the navbar leaving
    $("#nav").animate({
      "opacity" : "1",
      "top" : "-=100px"
    }, {duration:1000}, {easing:"swing"});
    $("#content").hide().load(page + ".html").fadeIn(1000);//find the file about.html and load it into content

    //stop the default of trying to load the href link
    return false;
  })

  //Clicking on back button
  $(document).on('click', "a.back-button", function() {
    var page = $(this).attr("href"); //take the href value (ie. about)
    //Animate the navbar returning
    $("#nav").animate({
      "opacity" : "1",
      "top" : "+=100px"
    }, {duration:1000}, {easing:"swing"});
    $("#content").hide().load(page + ".html").fadeIn(1000);//find the file about.html and load it into content

    //stop the default of trying to load the href link
    return false;
  })

});


