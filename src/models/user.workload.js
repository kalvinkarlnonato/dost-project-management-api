const sql = require("../utils/database");

const UserWorkload = function (userWorkload){
	this.id = userWorkload.ID;
	this.Campus = userWorkload.Campus;
	this.College = userWorkload.College;
	this.ClassCode = userWorkload.ClassCode;
	this.YR = userWorkload.YR;
	this.Sect = userWorkload.Sect;
	this.Course = userWorkload.Course;
	this.SubjectCode = userWorkload.SubjectCode;
	this.Description = userWorkload.Description;
	this.TotalUnits = userWorkload.TotalUnits;
}
UserWorkload.createWorkload = (newWorkload, result) => {
	sql.query("INSERT INTO workloads SET ?", newWorkload, (err, res) => {
		if (err) {
			result(err)
		} else {
			result(null, newWorkload);
			console.log(res);
		}
	})
}
module.exports = UserWorkload;