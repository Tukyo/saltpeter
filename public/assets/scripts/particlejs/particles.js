particlesJS("background", {
  particles: {
    number: {
      value: 100,
      density: {
        enable: true,
        value_area: 250
      }
    },
    color: {
      value: ["#ff0101", "#006aff", "#eb00ff"]
    },
    shape: {
      type: "circle",
      stroke: {
        width: 1,
        color: "#000000"
      },
      polygon: {
        nb_sides: 3
      }
    },
    opacity: {
      value: .75,
      random: false,
      anim: {
        enable: false,
        speed: 1,
        opacity_min: 0.1,
        sync: false
      }
    },
    size: {
      value: 2.5,
      random: true,
      anim: {
        enable: false,
        speed: 1,
        size_min: 0.1,
        sync: false
      }
    },
    line_linked: {
      enable: true,
      distance: 300,
      color: "#ffffff",
      opacity: 0.5,
      width: 1
    },
    move: {
      enable: true,
      speed: .05,
      direction: "none",
      random: false,
      straight: false,
      out_mode: "bounce",
      bounce: true,
      attract: {
        enable: false,
        rotateX: 600,
        rotateY: 1200
      }
    }
  },
  interactivity: {
    detect_on: "window",
    events: {
      onhover: {
        enable: true,
        mode: "bubble"
      },
      onclick: {
        enable: false,
        mode: "push"
      },
      resize: false
    },
    modes: {
      grab: {
        distance: 1140,
        line_linked: {
          opacity: 0
        }
      },
      bubble: {
        distance: 400,
        size: 1,
        duration: 2,
        opacity: 8,
        speed: 10
      },
      repulse: {
        distance: 200,
        duration: 0.4
      },
      push: {
        particles_nb: 4
      },
      remove: {
        particles_nb: 2
      }
    }
  },
  retina_detect: true,
  fn: {
    interact: {},
    modes: {},
    vendors: {
      lineColor: function (particle) {
        return particle.color.value;
      }
    }
  }
});

function initParticles() {
  const particlesJSInstance = pJSDom[0].pJS;
  const particles = particlesJSInstance.particles.array;

  // Configure how many of each color to keep (0.0 to 1.0)
  const KEEP_BLUE = 0.75;
  const KEEP_RED = 1.0;
  const KEEP_PURPLE = 0.5;

  const blueParticles = [];
  const redParticles = [];
  const purpleParticles = [];

  particles.forEach(p => {
    const r = p.color.rgb.r;
    const g = p.color.rgb.g;
    const b = p.color.rgb.b;

    if (r === 0 && g === 106 && b === 255) {
      p.atomType = 'blue';
      blueParticles.push(p);
      p.bondedReds = [];
    } else if (r === 255 && g === 1 && b === 1) {
      p.atomType = 'red';
      redParticles.push(p);
      p.bondedBlue = null;
      if (!p.resized) {
        p.radius = p.radius * 1.25;
        p.resized = true;
      }
    } else if (r === 235 && g === 0 && b === 255) {
      p.atomType = 'purple';
      purpleParticles.push(p);
    }
  });

  // Delete excess particles based on keep ratios
  const deleteParticles = (particleArray, keepRatio) => {
    const toKeep = Math.floor(particleArray.length * keepRatio);
    const toDelete = particleArray.slice(toKeep);

    toDelete.forEach(particle => {
      const index = particlesJSInstance.particles.array.indexOf(particle);
      if (index > -1) {
        particlesJSInstance.particles.array.splice(index, 1);
      }
    });

    return particleArray.slice(0, toKeep);
  };

  const activeBlues = deleteParticles(blueParticles, KEEP_BLUE);
  const activeReds = deleteParticles(redParticles, KEEP_RED);
  const activePurples = deleteParticles(purpleParticles, KEEP_PURPLE);

  // Assign bonds
  activeReds.forEach(red => {
    let closestBlue = null;
    let minDist = Infinity;

    activeBlues.forEach(blue => {
      if (blue.bondedReds.length < 3) {
        const dx = red.x - blue.x;
        const dy = red.y - blue.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < minDist) {
          minDist = dist;
          closestBlue = blue;
        }
      }
    });

    if (closestBlue) {
      closestBlue.bondedReds.push(red);
      red.bondedBlue = closestBlue;
    }
  });

  console.log('Bonds assigned:', {
    blues: activeBlues.length,
    reds: activeReds.length,
    purples: activePurples.length,
    bonded: activeReds.filter(r => r.bondedBlue).length
  });

  particlesJSInstance.fn.interact.linkParticles = function (p1, p2) {
    if (p1.atomType === 'purple' || p2.atomType === 'purple') return;

    if (p1.atomType === 'blue' && p1.bondedReds && p1.bondedReds.includes(p2)) {
    } else if (p2.atomType === 'blue' && p2.bondedReds && p2.bondedReds.includes(p1)) {
    } else {
      return;
    }

    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= particlesJSInstance.particles.line_linked.distance) {
      const opacity = particlesJSInstance.particles.line_linked.opacity - dist / particlesJSInstance.particles.line_linked.distance;

      if (opacity > 0) {
        const ctx = particlesJSInstance.canvas.ctx;
        const blueParticle = p1.atomType === 'blue' ? p1 : p2;
        const redParticle = p1.atomType === 'red' ? p1 : p2;

        const gradient = ctx.createLinearGradient(redParticle.x, redParticle.y, blueParticle.x, blueParticle.y);
        gradient.addColorStop(0, `rgba(255, 1, 1, ${opacity})`);
        gradient.addColorStop(1, `rgba(0, 106, 255, ${opacity})`);

        ctx.strokeStyle = gradient;
        ctx.lineWidth = particlesJSInstance.particles.line_linked.width;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        ctx.closePath();
      }
    }
  };
}

// Initial run
setTimeout(initParticles, 100);

// Re-run on window resize
window.addEventListener('resize', () => {
  setTimeout(initParticles, 100);
});