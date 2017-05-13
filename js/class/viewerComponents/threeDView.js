function ThreeDView(viewer, mapDiv, toolDiv)
{
	// Private fields pre-defined
	var _movementCtrl;
	
	/*
	 * Private fields to be computed
	 */
	// Handlers
	var _handler;				// Handler for mouse click and key click
	var _handlerDis;			// Distance measurement handler
	var _handlerHeight;			// Distance measurement for vertical/horizontal handler
	var _viewshedHandler;		// Viewshed handler
	
	// Flags
	var _selectBlockin2DFlag = false;	// Whether highlight the selected block in 2D
	
	var _modifiedList = [];		// Store the IDs representing the features modified
	
	// Public field
	this.viewer = viewer;
	this.mapDiv = mapDiv;
	this.toolDiv = toolDiv;
	this.viewMode = 'Bird-eye';
	this.selectedBlocks = {};	// Selected entities in the scene
	
	// Flags
	this.selectBlockFlag = true;		// Whether enable select 3D Blocks. Not implemented yet.
	
	/*
	 * Private functions
	 */
	// Shut down all handlers for drawing/analysis/etc..
	var deactivateHandlers = function(thisObj) {
		_handlerDis.deactivate();
		_handlerHeight.deactivate();
	}
	
	/*
	 * Public functions
	 */
	// Toggle between bird-eye and human-eye mode
	ThreeDView.prototype.toggleViewMode = function() {
		_movementCtrl.toggle();
		
		if(this.viewMode=='Bird-eye')
			this.viewMode = 'Human-eye';
		else
			this.viewMode = 'Bird-eye';
	}
	
	// Start distance measure
	ThreeDView.prototype.initDistanceMeasure = function() {
		deactivateHandlers(this);
		_handlerHeight && _handlerHeight.activate();
	}
	
	// Remove analysis result visualizations, remain blocks
	ThreeDView.prototype.removeAnalysisEntities = function() {
		var entities = this.viewer.entities.values;
		
		for(var i=entities.length-1; i>-1; i--)
		{
			var id = entities[i].id;
			if(id.substring(0,5)!='BLOCK')
				this.viewer.entities.remove(entities[i]);
		}
		
		_handlerDis.clear();
	}
	
	// Add selection for blocks
	ThreeDView.prototype.addBlockSelection = function(id) {
		this.clearSelection();
		
		if(id!=undefined)
		{
			if(id.substring(0,6)=='BLOCK_')
				id = id.substring(6,id.length);
			
			if (Cesium.defined(this.viewer.entities.getById('BLOCK_'+id))) {
				// Highlight selected block
				var entity = this.viewer.entities.getById('BLOCK_'+id);
				var id = 'BLOCK_'+id;
				var entityHeight = entity.polygon.extrudedHeight.getValue() - entity.polygon.height.getValue();
				
				// Check whether this entity is already included in selected list
				if(this.selectedBlocks[id]==undefined)
				{
					this.selectedBlocks[id] = entity;
					entity.polygon.material = Cesium.Color.AQUA;
				}
				
				// If also highlight the selected block in 2D
				if(_selectBlockin2DFlag)
				{
					;	// Not yet implementing this
				}
				
				// UI on the index
				$('#valueSelectedBlock').html(entity.name);
				$('#exBlockHeight').bootstrapSlider('setValue',entityHeight);
			}
		}
		else if(_modifiedList.length!=0)
		{
			alert('Should be a prompt box ask whether to confirm modification');
			
			// Save change to db
			var entities = [];
			for(var i=0; i<_modifiedList.length; i++)
			{
				entities.push(this.viewer.entities.getById(_modifiedList[i]));
			}
			
			// Suppose only modify the first one, because batch editing not ready on backend...
			var entity = entities[0];
			var baseHeight = entity.polygon.height.getValue();
			var elev = entity.polygon.extrudedHeight.getValue() - baseHeight;
			var id = entity.id.substring(6,entity.id.length);
			
			// Hard code on fields to be modified			
			var json = {
				"fieldNames": ["ELEVATION", "SMID"],
				"fieldValues": [elev+"", id],
				type: "UPDATEHEIGHT"
			};
			
			var dObject = {
				json: JSON.stringify(json)
			};
			
			$.ajax({
				url: host+'/iserver/PolygonEditing.jsp',
				data: dObject,
				dataType: "json",
				method: 'GET',		// Need more advanced jquery version, later than 1.9.0
				success: function (data) {                                  
					var state = data.state;
					if(state=='Success')
					{
						$('#txtSystemInfo').val("Update feature height succeed");
						/*vectorLayer.removeAllFeatures();
						layer.redraw();
						ids=null;
						
						document.getElementById("btnSelect").disabled = false;
						document.getElementById("btnEdit").disabled = true;
						document.getElementById("btnRemove").disabled = true;*/
					}
					else
						$('#txtSystemInfo').val("Update feature failed");
				},
				error: function(err) {
					alert("AJAX function failed");
					console.log(err);
				}
			});
			
			_modifiedList = [];
		}
	}
	
	// Clear selection for blocks
	ThreeDView.prototype.clearSelection = function() {
		for (var property in this.selectedBlocks) {
			if (this.selectedBlocks.hasOwnProperty(property)) {
				this.selectedBlocks[property].polygon.material = Cesium.Color.WHITE;
			}
		}
		this.selectedBlocks = {};
	}
	
	// Update height for selected block
	ThreeDView.prototype.updateHeight = function(h) {
		for (var property in this.selectedBlocks) {
			if (this.selectedBlocks.hasOwnProperty(property)) {
				var polygon = this.selectedBlocks[property].polygon;
				polygon.extrudedHeight = h + polygon.height.getValue();
			}
		}
	}
	
	// Add to modified list when a block has been edited
	// By now just assume that only selected block could be edited
	ThreeDView.prototype.addModifyList = function(id) {
		var id = [];
		
		for (var property in this.selectedBlocks) {
			if (this.selectedBlocks.hasOwnProperty(property)) {
				id.push(this.selectedBlocks[property].id);
			}
		}
		
		for(var i=0; i<id.length; i++)
		{
			if(!_modifiedList.includes(id[i]))
				_modifiedList.push(id[i]);
		}
		
		console.log(_modifiedList);
	}
	
	// Confirm modification for blocks
	ThreeDView.prototype.confirmEdit = function() {
		
	}
	
	// Update geometry for a specified entity
	ThreeDView.prototype.updateGeometry = function(vertexArray, bldgHeight) {
		for (var property in this.selectedBlocks) {
			if (this.selectedBlocks.hasOwnProperty(property)) {
				var polygon = this.selectedBlocks[property].polygon;
				var verticesCartesian = [];
				
				for(var j=0; j<vertexArray.length; j++)
				{
					var lat = vertexArray[j].y;
					var lng = vertexArray[j].x;
					
					var cartesian = Cesium.Cartesian3.fromDegrees(lng, lat, baseHeight);
					verticesCartesian.push(cartesian);
				}
				
				var baseHeight = 9999;
				
				for(var i=0; i<verticesCartesian.length; i++)
				{
					var cartoPos = Cesium.Cartographic.fromCartesian(verticesCartesian[i]);
					var height = cartoPos.height;
					var terrainHeight = this.viewer.scene.globe.getHeight(cartoPos);
					if(terrainHeight>height)
						height = terrainHeight;
					
					if(height<baseHeight)
						baseHeight = height;
				}
				
				polygon.hierarchy = new Cesium.PolygonHierarchy(verticesCartesian);
				polygon.height = baseHeight;
				polygon.extrudedHeight = height + bldgHeight;
			}
		}
	}
	
	/*
	 * Initialization after construction
	 */
	// Initialize movement control
	this.viewer.selectionIndicator.viewModel.selectionIndicatorElement.style.visibility = 'hidden'; 
    $('.cesium-infoBox').css('visibility','hidden'); 
	
	_movementCtrl = new MovementCtrl(this.viewer);
	
	// Define mouse click / key handler
	_handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
	
	// Redefine left click event, may not pop up default sidebar when clicking on entities
	_handler.setInputAction(function(e){
		var thisObj = threeDGIS.threeDView;
		
		var pickedObject = viewer.scene.pick(e.position);
		var id;
		
		if (Cesium.defined(pickedObject)) {
			// Highlight selected block
			var entity = pickedObject.id;
			id = entity.id;
		}
		else
			id=undefined;
		
		if(thisObj.selectBlockFlag)
			thisObj.addBlockSelection(id);
	},Cesium.ScreenSpaceEventType.LEFT_CLICK);
	
	// Instantiate distance measurement handler
	_handlerDis = new Cesium.MeasureHandler(this.viewer,Cesium.MeasureMode.Distance);
	_handlerDis.measureEvt.addEventListener(function(result){
		var distance = result.distance > 1000 ? (result.distance/1000).toFixed(2) + 'km' : result.distance + 'm';
		_handlerDis.disLabel.text = 'Distance:' + distance;
	});
	_handlerDis.activeEvt.addEventListener(function(isActive){
		if(isActive == true){
			$('body').removeClass('measureCur').addClass('measureCur');
		}
		else{
			$('body').removeClass('measureCur');
		}
	});
	
	// Instantiate height measurement handler
	_handlerHeight = new Cesium.MeasureHandler(viewer,Cesium.MeasureMode.DVH);
	_handlerHeight.measureEvt.addEventListener(function(result){
		var distance = result.distance > 1000 ? (result.distance/1000).toFixed(2) + 'km' : result.distance + 'm';
		var vHeight = result.verticalHeight > 1000 ? (result.verticalHeight/1000).toFixed(2) + 'km' : result.verticalHeight + 'm';
		var hDistance = result.horizontalDistance > 1000 ? (result.horizontalDistance/1000).toFixed(2) + 'km' : result.horizontalDistance + 'm';
		_handlerHeight.disLabel.text = '';//'空间距离:' + distance;
		_handlerHeight.vLabel.text = 'Vertical:' + vHeight;
		_handlerHeight.hLabel.text = 'Horizontal:' + hDistance;
	});
	_handlerHeight.activeEvt.addEventListener(function(isActive){
		if(isActive == true){
			$('body').removeClass('measureCur').addClass('measureCur');
		}
		else{
			$('body').removeClass('measureCur');
		}
	});
}