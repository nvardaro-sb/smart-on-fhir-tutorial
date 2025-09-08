(function(window){
  window.extractData = function() {
    var ret = $.Deferred();

    function onError() {
      console.log('🔥 FHIR OAuth Error:', arguments);
      console.log('📍 Current URL:', window.location.href);
      console.log('🔑 Session Storage:', Object.keys(sessionStorage).length > 0 ? sessionStorage : 'Empty');
      console.log('💾 Local Storage:', Object.keys(localStorage).length > 0 ? localStorage : 'Empty');
      
      // Show helpful error message
      $('#loading').hide();
      $('#holder').html(`
        <div style="padding: 40px; text-align: center;">
          <h2 style="color: #e74c3c;">⚠️ Authentication Required</h2>
          <p>This app requires OAuth authentication through a SMART launch.</p>
          <p><strong>Are you accessing this page directly?</strong></p>
          <div style="background: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 4px; text-align: left;">
            <p><strong>✅ Correct:</strong> Launch through EHR or sandbox</p>
            <p><strong>❌ Incorrect:</strong> Accessing index.html directly</p>
            <p><strong>💡 Try:</strong> Clear storage and launch properly</p>
          </div>
          <button onclick="sessionStorage.clear(); localStorage.clear(); alert('Storage cleared! Try launching again.');" 
                  style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Clear Storage & Retry
          </button>
        </div>
      `);
      
      ret.reject();
    }

    function onReady(smart)  {
      console.log('✅ FHIR OAuth Ready:', smart);
      console.log('🔍 Smart object keys:', Object.keys(smart || {}));
      
      if (smart.hasOwnProperty('patient')) {
        var patient = smart.patient;
        var pt = patient.read();
        var obv = smart.patient.api.fetchAll({
                    type: 'Observation',
                    query: {
                      code: {
                        $or: ['http://loinc.org|8302-2', 'http://loinc.org|8462-4',
                              'http://loinc.org|8480-6', 'http://loinc.org|2085-9',
                              'http://loinc.org|2089-1', 'http://loinc.org|55284-4']
                      }
                    }
                  });

        $.when(pt, obv).fail(onError);

        $.when(pt, obv).done(function(patient, obv) {
          var byCodes = smart.byCodes(obv, 'code');
          var gender = patient.gender;

          var fname = '';
          var lname = '';

          if (typeof patient.name !== 'undefined' && patient.name.length > 0 && typeof patient.name[0] !== 'undefined') {
            // Handle both array (FHIR DSTU2/STU3) and string (FHIR R4) formats for given names
            if (Array.isArray(patient.name[0].given)) {
              fname = patient.name[0].given.join(' ');
            } else if (typeof patient.name[0].given === 'string') {
              fname = patient.name[0].given;
            }
            
            // Handle both array (FHIR DSTU2/STU3) and string (FHIR R4) formats for family names
            if (Array.isArray(patient.name[0].family)) {
              lname = patient.name[0].family.join(' ');
            } else if (typeof patient.name[0].family === 'string') {
              lname = patient.name[0].family;
            }
          }

          var height = byCodes('8302-2');
          var systolicbp = getBloodPressureValue(byCodes('55284-4'),'8480-6');
          var diastolicbp = getBloodPressureValue(byCodes('55284-4'),'8462-4');
          var hdl = byCodes('2085-9');
          var ldl = byCodes('2089-1');

          var p = defaultPatient();
          p.birthdate = patient.birthDate;
          p.gender = gender;
          p.fname = fname;
          p.lname = lname;
          p.height = getQuantityValueAndUnit(height[0]);

          if (typeof systolicbp != 'undefined')  {
            p.systolicbp = systolicbp;
          }

          if (typeof diastolicbp != 'undefined') {
            p.diastolicbp = diastolicbp;
          }

          p.hdl = getQuantityValueAndUnit(hdl[0]);
          p.ldl = getQuantityValueAndUnit(ldl[0]);

          ret.resolve(p);
        });
      } else {
        onError();
      }
    }

    console.log('🚀 Starting FHIR OAuth flow...');
    FHIR.oauth2.ready(onReady, onError);
    return ret.promise();

  };

  function defaultPatient(){
    return {
      fname: {value: ''},
      lname: {value: ''},
      gender: {value: ''},
      birthdate: {value: ''},
      height: {value: ''},
      systolicbp: {value: ''},
      diastolicbp: {value: ''},
      ldl: {value: ''},
      hdl: {value: ''},
    };
  }

  function getBloodPressureValue(BPObservations, typeOfPressure) {
    var formattedBPObservations = [];
    BPObservations.forEach(function(observation){
      var BP = observation.component.find(function(component){
        return component.code.coding.find(function(coding) {
          return coding.code == typeOfPressure;
        });
      });
      if (BP) {
        observation.valueQuantity = BP.valueQuantity;
        formattedBPObservations.push(observation);
      }
    });

    return getQuantityValueAndUnit(formattedBPObservations[0]);
  }

  function getQuantityValueAndUnit(ob) {
    if (typeof ob != 'undefined' &&
        typeof ob.valueQuantity != 'undefined' &&
        typeof ob.valueQuantity.value != 'undefined' &&
        typeof ob.valueQuantity.unit != 'undefined') {
          return ob.valueQuantity.value + ' ' + ob.valueQuantity.unit;
    } else {
      return undefined;
    }
  }

  window.drawVisualization = function(p) {
    $('#holder').show();
    $('#loading').hide();
    
    // Display FHIR patient data
    $('#fname').html(p.fname);
    $('#lname').html(p.lname);
    $('#gender').html(p.gender);
    $('#birthdate').html(p.birthdate);
    $('#height').html(p.height);
    $('#systolicbp').html(p.systolicbp);
    $('#diastolicbp').html(p.diastolicbp);
    $('#ldl').html(p.ldl);
    $('#hdl').html(p.hdl);
    
    // Initialize Superblocks clinical dashboard
    initializeSuperblocksDashboard(p);
  };
  
  // Simple Superblocks Embed - just get it working first
  window.initializeSuperblocksDashboard = function(patientData) {
    console.log('🏥 Initializing Superblocks embed...');
    
    // Show the Superblocks section
    $('#superblocks-section').show();
    
    // Check if Superblocks SDK is available
    if (typeof Superblocks === 'undefined') {
      console.warn('⚠️ Superblocks SDK not loaded');
      $('#superblocks-container').html(`
        <div style="padding: 40px; text-align: center; color: #636e72;">
          <h3>Superblocks SDK not loaded</h3>
          <p>Please check your network connection.</p>
        </div>
      `);
      return;
    }
    
    try {
      // Simple embed - exactly like Superblocks template
      const sbApp = Superblocks.createSuperblocksEmbed({
        src: "https://app.superblocks.com/embed/applications/2e984c48-651a-4238-94ec-c4153a637930"
        // No properties for now - just get it working first
      });
      
      // Add it to our container
      const container = document.getElementById('superblocks-container');
      container.innerHTML = ''; // Clear any existing content
      container.appendChild(sbApp);
      
      console.log('✅ Superblocks embed added successfully');
      
    } catch (error) {
      console.error('❌ Error with Superblocks embed:', error);
      $('#superblocks-container').html(`
        <div style="padding: 40px; text-align: center; color: #e74c3c;">
          <h3>Embed Error</h3>
          <p>Error: ${error.message}</p>
        </div>
      `);
    }
  };
  
  // Helper function to calculate age from birth date
  function calculateAge(birthDate) {
    if (!birthDate) return 'Unknown';
    try {
      const birth = new Date(birthDate);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      return age + ' years';
    } catch (e) {
      return 'Unknown';
    }
  }

})(window);