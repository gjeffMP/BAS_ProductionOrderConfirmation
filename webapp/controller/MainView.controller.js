sap.ui.define([
	"sap/ui/core/mvc/Controller",
	'sap/ui/model/json/JSONModel',
	"sap/m/MessageBox",
	'sap/ui/model/type/String',
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	'sap/m/SearchField',
	"sap/ui/comp/valuehelpdialog/ValueHelpDialog",
	'sap/ui/table/Column',
	'sap/m/Column',
	'sap/m/Label',
	'sap/m/Text'
],
	function (Controller, JSONModel, MessageBox, TypeString, Filter, FilterOperator, SearchField, ValueHelpDialog, UIColumn, MColumn, Label, Text) {
		"use strict";

		var that

		return Controller.extend("com.mpmaterials.prodorderconfirmation.controller.MainView", {
			onInit: function () {
				that = this

				var oInputModel = new JSONModel({
					postingDate: new Date().toLocaleDateString(),
					labelWidth: "12em"
				});
				this.getView().setModel(oInputModel, "inputData");

				that.onProductionOrderValueHelp()
			},



			onProductionOrderValueHelp: function () {

				this._oBasicSearchField = new SearchField();
				this.loadFragment({
					name: "com.mpmaterials.prodorderconfirmation.view.ProductionOrderFilterbar"
				}).then(function (oDialog) {
					var oFilterBar = oDialog.getFilterBar()
					this._oVHD = oDialog;

					this.getView().addDependent(oDialog);

					// Set Basic Search for FilterBar
					oFilterBar.setFilterBarExpanded(false);
					oFilterBar.setBasicSearch(this._oBasicSearchField);

					// Trigger filter bar search when the basic search is fired
					this._oBasicSearchField.attachSearch(function () {
						oFilterBar.search();
					});


					// Set default value for ProductionPlant filter
					// debugger
					that.byId("plantVHInput").setValue("M400")
					that.byId("releasedVHInput").setValue("X")
					that.byId("closedVHInput").setValue(" ")


					oDialog.getTableAsync().then(function (oTable) {

						oTable.setModel(this.getView().getModel());

						// For Desktop and tabled the default table is sap.ui.table.Table
						if (oTable.bindRows) {
							// Bind rows to the ODataModel and add columns
							oTable.bindAggregation("rows", {
								path: "/ZCDS_ProdOrderWithStatus",
								events: {
									dataReceived: function () {
										oDialog.update();
									}
								}
							});
							oTable.addColumn(
								new UIColumn({ label: new Label({ text: "Prod. Order" }), template: new Text({ wrapping: false, text: "{ManufacturingOrder}" }) })
							)
							oTable.addColumn(
								new UIColumn({ label: new Label({ text: "Oper." }), template: new Text({ wrapping: false, text: "{ManufacturingOrderOperation}" }) })
							)

							oTable.addColumn(
								new UIColumn({ label: new Label({ text: "Product" }), template: new Text({ wrapping: false, text: "{Product} - {ProductName}" }) })
							)

							oTable.addColumn(
								new UIColumn({ label: new Label({ text: "Work Center" }), template: new Text({ wrapping: false, text: "{WorkCenter}" }) })
							)

							oTable.addColumn(new UIColumn(
								{
									label: new Label({ text: "Planned Start" }),
									template: new Text({
										wrapping: false,
										text: {
											path: "MfgOrderPlannedStartDate",
											formatter: this.formatDateOnly
										}
									})
								})
							)

							oTable.addColumn(new UIColumn(
								{
									label: new Label({ text: "Planned End" }),
									template: new Text({
										wrapping: false,
										text: {
											path: "MfgOrderPlannedEndDate",
											formatter: this.formatDateOnly
										}
									})
								})
							)

						}

						// For Mobile the default table is sap.m.Table
						if (oTable.bindItems) {
							// Bind items to the ODataModel and add columns
							oTable.bindAggregation("items", {
								path: "/ZCDS_ProdOrderWithStatus",
								template: new ColumnListItem({
									cells: [new Label({ text: "{ManufacturingOrder}" }), new Label({ text: "{ManufacturingOrder}" })]
								}),
								events: {
									dataReceived: function () {
										oDialog.update();
									}
								}
							});
							oTable.addColumn(new MColumn({ header: new Label({ text: "Prod. Order" }) }));
							oTable.addColumn(new MColumn({ header: new Label({ text: "Product" }) }));
						}
						oDialog.update();
					}.bind(this));

					// oDialog.setTokens(this.inputField.getTokens());
					oDialog.open();
				}.bind(this));

			},

			onValueHelpOkPress: function (oEvent) {
				// debugger
				var aTokens = oEvent.getParameter("tokens");
				if (aTokens) {
					var selectedItem = that.getView().getModel().getData("/ZCDS_ProdOrderWithStatus('" + aTokens[0].getKey() + "')")

					var oInputModel = that.getView().getModel("inputData")
					oInputModel.setProperty("/productionOrder", selectedItem.ManufacturingOrder)
					oInputModel.setProperty("/operation", selectedItem.ManufacturingOrderOperation)
					oInputModel.setProperty("/plant", selectedItem.ProductionPlant)
					oInputModel.setProperty("/workCenter", selectedItem.WorkCenter)
					oInputModel.setProperty("/confirmedUom", selectedItem.ProductionUnit)

				}
				this._oVHD.close();
			},

			onValueHelpCancelPress: function () {
				this._oVHD.close();
			},

			onValueHelpAfterClose: function () {
				this._oVHD.destroy();
			},

			onClickPostDocument: function () {
				var oInputModel = that.getView().getModel("inputData")
				var inputData = oInputModel.getData("/")
				that.postConfirmation(inputData)
			},

			postConfirmation: async function (inputData) {

				var csrfToken = ""
				// debugger;
				try {
					var payload = {
						"OrderID": inputData.productionOrder.toString(),
						"Sequence": "0",
						"OrderOperation": inputData.operation.toString(),
						// "Material": data.Material,
						"IsFinalConfirmation": false,
						// "OpenReservationsIsCleared": false,
						// "EnteredByExternalUser": "",
						// "ExternalSystemConfirmation": "00000000-0000-0000-0000-000000000000",
						"Plant": inputData.plant.toString(),
						"WorkCenter": inputData.workCenter.toString(),
						// "PostingDate": data.PostingDate.toISOString(),
						// "PostingDate": "/Date(" + inputData.postingDate.getTime() + ")/",    // They want the Date as a UNIX timestamp, formatted as a string, like "/Date(1642118400000)/"
						"PostingDate": "/Date(" + that.toUTCTimestamp(inputData.postingDate) + ")/",    // They want the Date as a UNIX timestamp, formatted as a string, like "/Date(1642118400000)/"
						"ConfirmationYieldQuantity": inputData.confirmedQty.toString(),
						"ConfirmationUnit": inputData.confirmedUom,
						"OpConfirmedWorkQuantity1": inputData.setupQty ? inputData.setupQty.toString() : "0.000",
						"OpConfirmedWorkQuantity2": inputData.laborQty ? inputData.laborQty.toString() : "0.000",
						"OpConfirmedWorkQuantity3": inputData.machineQty ? inputData.machineQty.toString() : "0.000",
						"OpConfirmedWorkQuantity4": inputData.overheadQty ? inputData.overheadQty.toString() : "0.000",
						"OpConfirmedWorkQuantity5": inputData.depreciationQty ? inputData.depreciationQty.toString() : "0.000",
						"OpWorkQuantityUnit1": inputData.setupUom ? inputData.setupUom : "",
						"OpWorkQuantityUnit2": inputData.laborUom ? inputData.laborUom : "",
						"OpWorkQuantityUnit3": inputData.machineUom ? inputData.machineUom : "",
						"OpWorkQuantityUnit4": inputData.overheadUom ? inputData.overheadUom : "",
						"OpWorkQuantityUnit5": inputData.depreciationUom ? inputData.depreciationUom : "",

					}

					// Get csrf Token first
					var url = "/sap/opu/odata/SAP/API_PROD_ORDER_CONFIRMATION_2_SRV/$metadata"
					var metaResp = await fetch(url, {
						method: "HEAD",
						headers: {
							'Content-Type': 'application/json',
							'Accept': 'application/json',
							'x-csrf-token': 'fetch'
							// 'If-Match': etag
						},
					});

					csrfToken = metaResp.headers.get("x-csrf-token")

					url = "/sap/opu/odata/SAP/API_PROD_ORDER_CONFIRMATION_2_SRV/ProdnOrdConf2"
					var resp = await fetch(url, {
						method: "POST",
						headers: {
							'Content-Type': 'application/json',
							'Accept': 'application/json',
							'x-csrf-token': csrfToken
							// 'If-Match': etag
						},
						body: JSON.stringify(payload)
						// body: payloadString
					});

					if (resp.ok) {
						var statusMessage = ""
						statusMessage = "Production Order Confirmation was Posted Successfully (ProdOrd: " + inputData.productionOrder + ", Operation: " + inputData.operation + ", Yield: " + inputData.confirmedQty.toString() + ")"

						try {
							var respJson = await resp.json()
							if (respJson.d.ConfirmationGroup) {
								statusMessage += '\nConfirmation: ' + respJson.d.ConfirmationGroup.toString() + ' Confirmation Qty: ' + respJson.d.ConfirmationYieldQuantity + " " + respJson.d.ConfirmationUnitSAPCode
							}
						}
						catch { }

						MessageBox.success(statusMessage)

					}
					else {
						var statusMessage = ""
						if (resp.status == "400") {
							statusMessage = "Error in Production Order Confirmation"
						}
						else {
							statusMessage = "Authorization Error (" + resp.status + ") in Production Order Confirmation"
						}

						try {
							var respJson = await resp.json()
							if (respJson.error.message.value) {
								statusMessage += '\n' + respJson.error.message.value
							}
						}
						catch { }

						MessageBox.error(statusMessage)

					}
				}
				catch {
					MessageBox.error("Error in Confirmation Data")
				}


			},

			onFilterBarChange: function (oEvent) {
				var oFilterBar = this.byId("productionOrderFilterBar");
				var aSelectionSet = oFilterBar.getAllFilterItems().map(function (oItem) {
					return oItem.getControl(); // Get the control for each filter item
				});

				// Simulate the GO Button event with a constructed object
				this.onFilterBarSearch({
					getParameter: function (sParam) {
						if (sParam === "selectionSet") {
							return aSelectionSet;
						}
					}
				});
			},


			onFilterBarSearch: function (oEvent) {
				var sSearchQuery = this._oBasicSearchField.getValue(),
					aSelectionSet = oEvent.getParameter("selectionSet");

				var aFilters = aSelectionSet.reduce(function (aResult, oControl) {
					if (oControl.getValue()) {
						aResult.push(new Filter({
							path: oControl.getName(),
							operator: FilterOperator.Contains,
							value1: oControl.getValue()
						}));
					}

					return aResult;
				}, []);

				aFilters.push(new Filter({
					filters: [
						new Filter({ path: "ManufacturingOrder", operator: FilterOperator.Contains, value1: sSearchQuery }),
						new Filter({ path: "Product", operator: FilterOperator.Contains, value1: sSearchQuery }),
						new Filter({ path: "ProductName", operator: FilterOperator.Contains, value1: sSearchQuery })
					],
					and: false
				}));

				this._filterTable(new Filter({
					filters: aFilters,
					and: true
				}));
			},

			_filterTable: function (oFilter) {
				var oVHD = this._oVHD;

				oVHD.getTableAsync().then(function (oTable) {
					if (oTable.bindRows) {
						oTable.getBinding("rows").filter(oFilter);
					}
					if (oTable.bindItems) {
						oTable.getBinding("items").filter(oFilter);
					}

					// This method must be called after binding update of the table.
					oVHD.update();
				});
			},

			onQtyChange: function (e) {
				// debugger
				var oInputModel = that.getView().getModel("inputData")
				var inputData = oInputModel.getData("/")

				try {
					oInputModel.setProperty("/overheadQty", parseFloat(inputData.setupQty) + parseFloat(inputData.laborQty))
					oInputModel.setProperty("/overheadUom", 'HR')
					oInputModel.setProperty("/setupUom", 'HR')
					oInputModel.setProperty("/laborUom", 'HR')
				}
				catch { }

				try {
					oInputModel.setProperty("/depreciationQty", parseFloat(inputData.machineQty))
					oInputModel.setProperty("/depreciationUom", 'HR')
					oInputModel.setProperty("/machineUom", 'HR')
				}
				catch { }

			},

			formatDateOnly: function (oDate) {
				if (!oDate || !(oDate instanceof Date)) {
					return "";
				}

				// Create a new Date object based on the UTC date
				var localDate = new Date(oDate.getTime() + oDate.getTimezoneOffset() * 60000);

				// Use toLocaleDateString to format the date as MM/DD/YYYY (or another desired format)
				return localDate.toLocaleDateString();  // Format based on locale, e.g., MM/DD/YYYY for US
			},

			toUTCTimestamp: function (dateString) {
				// Create a new Date object using the parts of the input date string
				const [month, day, year] = dateString.split('/').map(Number);
				const utcDate = new Date(Date.UTC(year, month - 1, day));

				// Return the UNIX timestamp
				return utcDate.getTime();
			}


		});
	});
