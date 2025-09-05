(function(window){
  window.extractData = function() {
    var ret = $.Deferred();

    function onError() {
      console.error('FHIR Loading error details:', arguments);
      console.error('Error occurred at:', new Date().toISOString());
      console.error('Current URL:', window.location.href);
      console.error('Session storage:', window.sessionStorage);
      console.error('Local storage:', window.localStorage);
      ret.reject();
    }

    function onReady(smart)  {
      console.log('FHIR client ready, smart object:', smart);
      console.log('Smart object keys:', Object.keys(smart));
      
      if (smart.hasOwnProperty('patient')) {
        console.log('Patient context available:', smart.patient);
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

        $.when(pt, obv).fail(function(error) {
          console.error('Failed to fetch patient data or observations:', error);
          onError();
        });

        $.when(pt, obv).done(function(patient, obv) {
          console.log('Successfully fetched patient data:', patient);
          console.log('Successfully fetched observations:', obv);
          
          var byCodes = smart.byCodes(obv, 'code');
          var gender = patient.gender;

          var fname = '';
          var lname = '';

          console.log('Patient name structure:', patient.name);
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
        console.error('No patient context available in SMART object');
        console.error('Available SMART object properties:', Object.keys(smart));
        onError();
      }
    }

    try {
      FHIR.oauth2.ready(onReady, onError);
    } catch (e) {
      console.error('Error initializing FHIR client:', e);
      onError();
    }
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
    $('#fname').html(p.fname);
    $('#lname').html(p.lname);
    $('#gender').html(p.gender);
    $('#birthdate').html(p.birthdate);
    $('#height').html(p.height);
    $('#systolicbp').html(p.systolicbp);
    $('#diastolicbp').html(p.diastolicbp);
    $('#ldl').html(p.ldl);
    $('#hdl').html(p.hdl);
  };

})(window);
