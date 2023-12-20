function checkForSnow () {
  if ( $('BODY').css('background-image').search("-snow.") > -1 ) {
    addSnow();
  } else {
    removeSnow();
  }
}


function addSnow () {
  console.log("Adding snow!");
  for (i=0; i<150; i++) {
    var size = Math.max(0.3,Math.random()*4);
    var css = 'width: '+size+'vw; height: '+size+'vw;';
    //css += ' opacity: '+0.3+';';
    css += ' filter: blur('+Math.max(0,(size/8-0.05))+'vw);';
    css += ' animation-duration: '+(53-(size*7))+'s;';
    //css += ' animation-duration: '+((Math.random()*5)+10)+'s;';
    css += ' animation-delay: '+((Math.random()*23))+'s; ';
    css += ' left: '+Math.random()*100+'vw;';
    //if ( size < 2.5 ) css += ' animation-name: falling-mid;';
    //if ( size < 1.5 ) css += ' animation-name: falling-far;';
    $("#snow").append('<div class="flake" style="'+css+'"></div>');
  }
}


function removeSnow () {
  $("#snow").html("");
  //console.log("The snow has been removed.");
}
