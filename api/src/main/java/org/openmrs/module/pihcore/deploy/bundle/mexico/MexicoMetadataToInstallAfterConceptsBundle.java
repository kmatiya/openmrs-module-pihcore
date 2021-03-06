package org.openmrs.module.pihcore.deploy.bundle.mexico;

import org.openmrs.module.metadatadeploy.bundle.AbstractMetadataBundle;
import org.openmrs.module.metadatadeploy.bundle.Requires;
import org.openmrs.module.pihcore.deploy.bundle.core.program.ANCProgramBundle;
import org.openmrs.module.pihcore.deploy.bundle.core.program.AsthmaProgramBundle;
import org.openmrs.module.pihcore.deploy.bundle.core.program.DiabetesProgramBundle;
import org.openmrs.module.pihcore.deploy.bundle.core.program.EpilepsyProgramBundle;
import org.openmrs.module.pihcore.deploy.bundle.core.program.HypertensionProgramBundle;
import org.openmrs.module.pihcore.deploy.bundle.core.program.MalnutritionProgramBundle;
import org.openmrs.module.pihcore.deploy.bundle.core.program.MentalHealthProgramBundle;
import org.springframework.stereotype.Component;


// this is a separate bundle that needs to be installed via the Mirebalais Metadata module *after*
// concepts have been installed via metadata sharing (since programs reference concepts)
@Component
@Requires({
        ANCProgramBundle.class,
        AsthmaProgramBundle.class,
        DiabetesProgramBundle.class,
        EpilepsyProgramBundle.class,
        HypertensionProgramBundle.class,
        MalnutritionProgramBundle.class,
        MentalHealthProgramBundle.class
})
public class MexicoMetadataToInstallAfterConceptsBundle extends AbstractMetadataBundle {
    @Override
    public void install() throws Exception {
    }
}
